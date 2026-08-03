"""Backfill an Assignment row for every mother that doesn't have one yet.

Two categories are covered:

1. Mothers whose ``PatientProfile.assigned_provider`` is set but who never
   got a corresponding ``Assignment`` row (e.g. legacy registrations from
   before the model existed, or a partially-applied backfill migration).
2. Mothers with no provider at all — assigned to the least-loaded active
   provider at their hospital (or globally, if their hospital has none).

Idempotent: uses ``get_or_create`` on the OneToOne ``mother`` field, so
re-running does nothing on rows already handled.

Usage:

    python manage.py assign_unassigned_mothers            # do the work
    python manage.py assign_unassigned_mothers --dry-run  # print the plan only
"""
from collections import Counter

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F

from accounts.models import Assignment, ProviderProfile
from accounts.serializers import (
    assign_least_loaded_provider,
    assign_least_loaded_provider_global,
)
from patients.models import PatientProfile


class Command(BaseCommand):
    help = 'Backfill Assignment rows for mothers who have no active assignment.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print the plan but write nothing to the database.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        assigned_from_legacy_fk = 0
        assigned_from_scratch = 0
        skipped_already = 0
        skipped_no_provider_available = []
        per_provider = Counter()
        errors = []

        # Snapshot everything up front so we don't race with concurrent writes.
        profiles = list(
            PatientProfile.objects
            .select_related('assigned_provider', 'hospital', 'user')
            .order_by('pk')
        )

        for profile in profiles:
            if Assignment.objects.filter(mother=profile).exists():
                skipped_already += 1
                continue

            # Prefer the mother's existing legacy FK, if any — the migration
            # should have handled these already, but this makes the command
            # a full safety net.
            provider = profile.assigned_provider
            picked_from_scratch = False
            if provider is None:
                provider = assign_least_loaded_provider(profile.hospital) or assign_least_loaded_provider_global()
                picked_from_scratch = True

            if provider is None:
                skipped_no_provider_available.append(profile.user.full_name or f'mother #{profile.pk}')
                continue

            per_provider[provider.user.full_name] += 1

            if dry_run:
                if picked_from_scratch:
                    assigned_from_scratch += 1
                else:
                    assigned_from_legacy_fk += 1
                continue

            try:
                with transaction.atomic():
                    Assignment.objects.create(
                        mother=profile,
                        provider=provider,
                        assigned_by=None,
                    )
                    if picked_from_scratch:
                        # Also mirror into the legacy FK so the two stay in
                        # sync — the field is dropped by Task 5, not here.
                        profile.assigned_provider = provider
                        profile.save(update_fields=['assigned_provider'])
                        ProviderProfile.objects.filter(pk=provider.pk).update(
                            current_workload=F('current_workload') + 1
                        )
                        assigned_from_scratch += 1
                    else:
                        assigned_from_legacy_fk += 1
            except Exception as e:
                errors.append(f'{profile.user.full_name or profile.pk}: {e}')

        self._report(
            dry_run=dry_run,
            assigned_from_legacy_fk=assigned_from_legacy_fk,
            assigned_from_scratch=assigned_from_scratch,
            skipped_already=skipped_already,
            skipped_no_provider_available=skipped_no_provider_available,
            per_provider=per_provider,
            errors=errors,
        )

    def _report(self, *, dry_run, assigned_from_legacy_fk, assigned_from_scratch,
                skipped_already, skipped_no_provider_available, per_provider, errors):
        header = '[DRY RUN] ' if dry_run else ''
        self.stdout.write(self.style.MIGRATE_HEADING(f'{header}assign_unassigned_mothers'))
        self.stdout.write(f'  Already assigned (skipped):        {skipped_already}')
        self.stdout.write(f'  Would-assign from legacy FK:       {assigned_from_legacy_fk}'
                          if dry_run else
                          f'  Assigned from legacy FK:           {assigned_from_legacy_fk}')
        self.stdout.write(f'  Would-assign from scratch:         {assigned_from_scratch}'
                          if dry_run else
                          f'  Assigned from scratch:             {assigned_from_scratch}')

        if per_provider:
            self.stdout.write('  Per-provider load added:')
            for name, count in per_provider.most_common():
                self.stdout.write(f'    - {name}: +{count}')

        if skipped_no_provider_available:
            self.stdout.write(self.style.WARNING(
                f'  Could not assign (no active provider available): '
                f'{len(skipped_no_provider_available)}'
            ))
            for name in skipped_no_provider_available:
                self.stdout.write(f'    - {name}')

        if errors:
            self.stdout.write(self.style.ERROR(f'  Errors: {len(errors)}'))
            for msg in errors:
                self.stdout.write(f'    - {msg}')

        if dry_run:
            self.stdout.write(self.style.NOTICE('  (no changes written — remove --dry-run to apply)'))
        else:
            self.stdout.write(self.style.SUCCESS('  Done.'))
