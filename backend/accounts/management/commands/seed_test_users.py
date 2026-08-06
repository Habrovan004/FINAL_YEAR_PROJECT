"""Create or refresh four test users for local or deployed environments.

Usage:
    python manage.py seed_test_users

Idempotent: re-running updates passwords and ensures profiles exist.

Creates:
- Vera (patient)    phone: +255700000101  password: MotherVera123!
- Lilian (patient)  phone: +255700000102  password: MotherLilian123!
- Hagai (provider)  phone: +255700000103  password: ProviderHagai123!
- Benedict(provider)phone: +255700000104  password: ProviderBenedict123!

By default the command attaches patients/providers to the first available Hospital.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth import get_user_model

try:
    from accounts.models import ProviderProfile
except Exception:
    ProviderProfile = None

try:
    from patients.models import PatientProfile
except Exception:
    PatientProfile = None

from hospitals.models import Hospital

User = get_user_model()

TEST_USERS = {
    'vera': {
        'phone': '+255700000101',
        'full_name': 'Vera',
        'user_type': 'patient',
        'email': 'vera@example.test',
        'password': 'MotherVera123!',
    },
    'lilian': {
        'phone': '+255700000102',
        'full_name': 'Lilian',
        'user_type': 'patient',
        'email': 'lilian@example.test',
        'password': 'MotherLilian123!',
    },
    'hagai': {
        'phone': '+255700000103',
        'full_name': 'Hagai',
        'user_type': 'provider',
        'email': 'hagai@example.test',
        'password': 'ProviderHagai123!',
    },
    'benedict': {
        'phone': '+255700000104',
        'full_name': 'Benedict',
        'user_type': 'provider',
        'email': 'benedict@example.test',
        'password': 'ProviderBenedict123!',
    },
}


class Command(BaseCommand):
    help = 'Create or refresh four test users (2 patients, 2 providers) for manual login/testing.'

    @transaction.atomic
    def handle(self, *args, **options):
        hospital = (
            Hospital.objects
            .filter()
            .order_by('id')
            .first()
        )
        if not hospital:
            raise CommandError(
                'No Hospital rows in the DB. Seed hospitals first (e.g. via existing fixtures) and re-run this command.'
            )

        created = []
        updated = []

        # Create provider users first so patients can be linked if desired
        for key in ('hagai', 'benedict'):
            spec = TEST_USERS[key]
            user, existed = self._upsert_user(
                phone=spec['phone'],
                full_name=spec['full_name'],
                user_type=spec['user_type'],
                email=spec['email'],
                password=spec['password'],
            )
            if existed:
                created.append(spec['phone'])
            else:
                updated.append(spec['phone'])

            if ProviderProfile:
                prof, _ = ProviderProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        'hospital': hospital,
                        'specialization': 'nurse',
                        'is_available': True,
                    },
                )

        # Create patients
        for key in ('vera', 'lilian'):
            spec = TEST_USERS[key]
            user, existed = self._upsert_user(
                phone=spec['phone'],
                full_name=spec['full_name'],
                user_type=spec['user_type'],
                email=spec['email'],
                password=spec['password'],
            )
            if existed:
                created.append(spec['phone'])
            else:
                updated.append(spec['phone'])

            if PatientProfile:
                # Assign the first provider at the hospital as their assigned_provider when possible
                provider_profile = ProviderProfile.objects.filter(hospital=hospital).order_by('id').first() if ProviderProfile else None
                PatientProfile.objects.update_or_create(
                    user=user,
                    defaults={
                        'hospital': hospital,
                        'assigned_provider': provider_profile,
                        'onboarding_completed': True,
                    },
                )

        self.stdout.write(self.style.SUCCESS(
            'Test users ensured:\n'
            f'  Created phones: {created}\n'
            f'  Updated phones: {updated}\n'
            'Credentials:\n'
            f"  Vera     -> phone: {TEST_USERS['vera']['phone']}  password: {TEST_USERS['vera']['password']}\n"
            f"  Lilian   -> phone: {TEST_USERS['lilian']['phone']}  password: {TEST_USERS['lilian']['password']}\n"
            f"  Hagai    -> phone: {TEST_USERS['hagai']['phone']}  password: {TEST_USERS['hagai']['password']}\n"
            f"  Benedict -> phone: {TEST_USERS['benedict']['phone']}  password: {TEST_USERS['benedict']['password']}\n"
        ))

    @staticmethod
    def _upsert_user(*, phone, full_name, user_type, email, password):
        user, created = User.objects.get_or_create(
            phone_number=phone,
            defaults={
                'full_name': full_name,
                'user_type': user_type,
                'email': email,
            },
        )
        # If already existed, update fields and password
        user.full_name = full_name
        user.user_type = user_type
        user.email = email
        user.is_verified = True
        user.is_active = True
        user.set_password(password)
        user.save()
        return user, created
