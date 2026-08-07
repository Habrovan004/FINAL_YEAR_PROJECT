"""
Safe provider seeding command.
Reads provider data from environment variables — no hardcoded credentials.
Safe to run multiple times (get_or_create).
GitGuardian-safe: zero secrets in source code.

Usage:
  Set env vars, then run:
  python manage.py seed_providers

Required env vars (set in Render dashboard or local .env):
  PROVIDER_1_PHONE, PROVIDER_1_NAME, PROVIDER_1_PASSWORD,
  PROVIDER_1_LICENSE, PROVIDER_1_SPEC
  PROVIDER_2_PHONE, PROVIDER_2_NAME, PROVIDER_2_PASSWORD,
  PROVIDER_2_LICENSE, PROVIDER_2_SPEC
  PROVIDER_3_PHONE, PROVIDER_3_NAME, PROVIDER_3_PASSWORD,
  PROVIDER_3_LICENSE, PROVIDER_3_SPEC
  PROVIDER_HOSPITAL_ID  (integer, default 1)
"""
import os
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from accounts.models import User, ProviderProfile
from hospitals.models import Hospital


class Command(BaseCommand):
    help = 'Seed 3 provider accounts from environment variables (GitGuardian-safe)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print what would be created without saving anything',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        hospital_id = int(os.environ.get('PROVIDER_HOSPITAL_ID', 1))

        try:
            hospital = Hospital.objects.get(pk=hospital_id)
        except Hospital.DoesNotExist:
            raise CommandError(
                f'Hospital with id={hospital_id} not found. '
                f'Set PROVIDER_HOSPITAL_ID to a valid hospital id. '
                f'Available: {list(Hospital.objects.values_list("id", "name"))}'
            )

        providers = []
        for i in range(1, 4):
            phone    = os.environ.get(f'PROVIDER_{i}_PHONE')
            name     = os.environ.get(f'PROVIDER_{i}_NAME')
            password = os.environ.get(f'PROVIDER_{i}_PASSWORD')
            license_ = os.environ.get(f'PROVIDER_{i}_LICENSE')
            spec     = os.environ.get(f'PROVIDER_{i}_SPEC', 'midwife')

            missing = [
                k for k, v in {
                    f'PROVIDER_{i}_PHONE': phone,
                    f'PROVIDER_{i}_NAME': name,
                    f'PROVIDER_{i}_PASSWORD': password,
                    f'PROVIDER_{i}_LICENSE': license_,
                }.items() if not v
            ]
            if missing:
                raise CommandError(
                    f'Missing environment variables for provider {i}: '
                    + ', '.join(missing)
                )

            providers.append({
                'phone': phone,
                'name': name,
                'password': password,
                'license': license_,
                'spec': spec,
            })

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — nothing will be saved'))
            for i, p in enumerate(providers, 1):
                self.stdout.write(
                    f'  Provider {i}: {p["name"]} | {p["phone"]} | '
                    f'{p["spec"]} | hospital={hospital.name}'
                )
            return

        created_count = 0
        skipped_count = 0

        with transaction.atomic():
            for p in providers:
                user, created = User.objects.get_or_create(
                    phone_number=p['phone'],
                    defaults={
                        'full_name': p['name'],
                        'user_type': 'provider',
                        'is_active': True,
                        'is_verified': True,
                    }
                )

                if created:
                    user.set_password(p['password'])
                    user.save()
                    self.stdout.write(self.style.SUCCESS(f'  Created user: {user.full_name} ({user.phone_number})'))
                    created_count += 1
                else:
                    self.stdout.write(self.style.WARNING(f'  Already exists: {user.full_name} ({user.phone_number}) — skipped'))
                    skipped_count += 1

                ProviderProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'hospital': hospital,
                        'specialization': p['spec'],
                        'license_number': p['license'],
                        'is_available': True,
                    }
                )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Done. Created: {created_count}, Already existed: {skipped_count}'
        ))
