from django.core.management.base import BaseCommand
from django.db.models import F

from patients.models import PatientProfile
from accounts.models import ProviderProfile


class Command(BaseCommand):
    help = (
        "Assign every patient that has no provider to an available provider "
        "(prefers the same hospital, falls back to least-busy). Useful for "
        "dev/demo so the provider's patient list and ANC visit form are not empty."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report what would change without writing to the DB.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        unassigned = PatientProfile.objects.filter(assigned_provider__isnull=True).select_related('user', 'hospital')
        total = unassigned.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS('No unassigned patients. Nothing to do.'))
            return

        assigned = 0
        skipped = 0
        for profile in unassigned:
            provider = self._pick_provider(profile)
            if not provider:
                self.stdout.write(self.style.WARNING(
                    f'  ! No available provider for patient {profile.user_id} ({profile.user.full_name})'
                ))
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(
                    f'  → would assign patient {profile.user_id} ({profile.user.full_name}) '
                    f'to provider {provider.user_id} ({provider.user.full_name})'
                )
            else:
                profile.assigned_provider = provider
                profile.save(update_fields=['assigned_provider'])
                provider.current_workload = F('current_workload') + 1
                provider.save(update_fields=['current_workload'])
                self.stdout.write(self.style.SUCCESS(
                    f'  ✓ assigned patient {profile.user_id} ({profile.user.full_name}) '
                    f'to provider {provider.user_id} ({provider.user.full_name})'
                ))
            assigned += 1

        verb = 'Would assign' if dry_run else 'Assigned'
        self.stdout.write(self.style.SUCCESS(
            f'{verb} {assigned}/{total} patient(s); skipped {skipped}.'
        ))

    @staticmethod
    def _pick_provider(profile):
        # Same-hospital provider with capacity first.
        if profile.hospital_id:
            same_hospital = (
                ProviderProfile.objects
                .filter(hospital_id=profile.hospital_id, is_available=True, current_workload__lt=F('max_workload'))
                .order_by('current_workload')
                .first()
            )
            if same_hospital:
                return same_hospital
        # Otherwise least-busy available provider anywhere.
        return (
            ProviderProfile.objects
            .filter(is_available=True, current_workload__lt=F('max_workload'))
            .order_by('current_workload')
            .first()
        )
