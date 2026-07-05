"""Seed/refresh demo provider accounts with known credentials.

Run:
    python manage.py seed_demo_accounts

Idempotent: re-running just re-asserts the password, verifies the user, and
ensures the profile row + hospital link exist.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User, ProviderProfile
from hospitals.models import Hospital
from patients.models import PatientProfile


DEMO_MOTHER_PHONE = '0700999888'
DEMO_MOTHER_PASSWORD = 'Mama123!'

DEMO_PROVIDER_PHONE = '+255700111222'
DEMO_PROVIDER_PASSWORD = 'Provider123!'


class Command(BaseCommand):
    help = (
        'Create or refresh a demo provider account so the frontend login flow '
        'can be exercised end-to-end without going through OTP signup.'
    )

    @transaction.atomic
    def handle(self, *args, **options):
        # Prefer a hospital that already has at least one patient — the demo
        # provider's ANC dashboard is then immediately exercisable.
        hospital = (
            Hospital.objects
            .filter(patientprofile__isnull=False)
            .order_by('id')
            .first()
        ) or Hospital.objects.order_by('id').first()
        if not hospital:
            raise CommandError(
                'No Hospital rows in the DB. Seed hospitals first '
                '(e.g. via the existing hospital fixtures/seed) and re-run this command.'
            )

        provider_user = self._upsert_user(
            phone=DEMO_PROVIDER_PHONE,
            full_name='Demo Provider',
            password=DEMO_PROVIDER_PASSWORD,
            user_type='provider',
            email='demo.provider@example.test',
        )
        provider_profile, _ = ProviderProfile.objects.update_or_create(
            user=provider_user,
            defaults={'hospital': hospital, 'specialization': 'nurse', 'is_available': True},
        )

        mother_user = self._upsert_user(
            phone=DEMO_MOTHER_PHONE,
            full_name='Demo Mama',
            password=DEMO_MOTHER_PASSWORD,
            user_type='patient',
            email='demo.mama@example.test',
        )
        PatientProfile.objects.update_or_create(
            user=mother_user,
            defaults={
                'hospital': hospital,
                'assigned_provider': provider_profile,
                'pregnancy_status': 'pregnant',
                'onboarding_completed': True,
            },
        )

        # Make sure every patient at this hospital is wired to the demo
        # provider so the ANC visit form has a non-empty patient list.
        patients_at_hospital = PatientProfile.objects.filter(hospital=hospital)
        reassigned = patients_at_hospital.update(assigned_provider=provider_profile)

        self.stdout.write(self.style.SUCCESS(
            '\nDemo accounts ready (all verified, hospital '
            f'"{hospital.name}"):\n'
            f'  Mama     ->phone: {DEMO_MOTHER_PHONE}     password: {DEMO_MOTHER_PASSWORD}\n'
            f'  Provider ->phone: {DEMO_PROVIDER_PHONE}   password: {DEMO_PROVIDER_PASSWORD}\n'
            f'  Wired {reassigned} patient(s) at "{hospital.name}" to the demo provider.\n'
        ))

    @staticmethod
    def _upsert_user(*, phone, full_name, password, user_type, email):
        user, _ = User.objects.get_or_create(
            phone_number=phone,
            defaults={
                'full_name': full_name,
                'user_type': user_type,
                'email': email,
            },
        )
        user.full_name = full_name
        user.user_type = user_type
        user.email = email
        user.is_verified = True
        user.is_active = True
        user.set_password(password)
        user.save()
        return user
