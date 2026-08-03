from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import F
from .models import User, ProviderProfile, Assignment
from patients.models import PatientProfile
from hospitals.models import Hospital


def assign_least_loaded_provider(hospital):
    """Pick the available provider at this hospital with the lowest
    ``current_workload``. Ties broken by earliest provider registration —
    stable ordering so repeated calls produce the same result under equal
    load."""
    if not hospital:
        return None
    return (
        ProviderProfile.objects
        .filter(hospital=hospital, is_available=True)
        .order_by('current_workload', 'user__created_at', 'pk')
        .first()
    )


def assign_least_loaded_provider_global():
    """Fallback for backfill / non-hospital-scoped assignment: pick the
    globally least-loaded active provider. Same tie-break as
    ``assign_least_loaded_provider``."""
    return (
        ProviderProfile.objects
        .filter(is_available=True)
        .order_by('current_workload', 'user__created_at', 'pk')
        .first()
    )


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    hospital_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    specialization = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'phone_number', 'email', 'full_name', 'date_of_birth',
            'user_type', 'password', 'hospital_id', 'specialization',
        ]

    def validate_user_type(self, value):
        allowed = {'patient', 'provider'}
        if value not in allowed:
            raise serializers.ValidationError(f"Role must be one of: {', '.join(allowed)}")
        return value

    def create(self, validated_data):
        hospital_id = validated_data.pop('hospital_id', None)
        specialization = validated_data.pop('specialization', '') or 'nurse'
        hospital = None
        if hospital_id:
            try:
                hospital = Hospital.objects.get(pk=hospital_id)
            except Hospital.DoesNotExist:
                raise serializers.ValidationError({'hospital_id': 'Hospital not found.'})

        with transaction.atomic():
            user = User.objects.create_user(**validated_data)
            user.is_verified = True
            user.save(update_fields=['is_verified'])

            if user.user_type == 'patient':
                # Auto-assign least-loaded provider at the chosen facility,
                # falling back to any globally available provider so a mother
                # is never left without care while providers are still being
                # onboarded at her hospital.
                assigned = assign_least_loaded_provider(hospital) or assign_least_loaded_provider_global()
                if assigned is None:
                    raise serializers.ValidationError({
                        'provider': (
                            'No active healthcare provider is currently available to be assigned. '
                            'Please contact administration.'
                        ),
                    })
                profile = PatientProfile.objects.create(
                    user=user,
                    hospital=hospital,
                    assigned_provider=assigned,
                )
                Assignment.objects.create(
                    mother=profile,
                    provider=assigned,
                    assigned_by=None,  # auto-assignment by the system
                )
                ProviderProfile.objects.filter(pk=assigned.pk).update(
                    current_workload=F('current_workload') + 1
                )

            elif user.user_type == 'provider':
                if not hospital:
                    raise serializers.ValidationError({'hospital_id': 'Providers must be linked to a hospital.'})
                valid_specs = {'obstetrician', 'midwife', 'nurse'}
                if specialization not in valid_specs:
                    specialization = 'nurse'
                provider_profile = ProviderProfile.objects.create(
                    user=user,
                    hospital=hospital,
                    specialization=specialization,
                )
                # Patients who chose this hospital before any provider was available
                # there are left with assigned_provider=None forever otherwise — pick
                # up unassigned patients at this hospital now, up to capacity.
                capacity = provider_profile.max_workload - provider_profile.current_workload
                if capacity > 0:
                    waiting = list(
                        PatientProfile.objects.filter(hospital=hospital, assigned_provider__isnull=True)[:capacity]
                    )
                    if waiting:
                        for p in waiting:
                            p.assigned_provider = provider_profile
                        PatientProfile.objects.bulk_update(waiting, ['assigned_provider'])
                        # Mirror those picked-up patients into Assignment rows so
                        # the new model stays in sync with the legacy FK.
                        Assignment.objects.bulk_create([
                            Assignment(mother=p, provider=provider_profile, assigned_by=None)
                            for p in waiting
                        ])
                        ProviderProfile.objects.filter(pk=provider_profile.pk).update(
                            current_workload=F('current_workload') + len(waiting)
                        )

        return user


class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['phone_number'], password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid phone number or password.')

        tokens = RefreshToken.for_user(user)
        user_data = UserSerializer(user).data
        return {
            'user': user_data,
            'access': str(tokens.access_token),
            'refresh': str(tokens),
        }


class UserSerializer(serializers.ModelSerializer):
    is_onboarded = serializers.SerializerMethodField()
    hospital_id = serializers.SerializerMethodField()
    hospital_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'phone_number', 'email', 'full_name', 'user_type',
            'date_of_birth', 'is_verified', 'is_onboarded',
            'hospital_id', 'hospital_name',
        ]

    def get_is_onboarded(self, obj):
        if obj.user_type == 'patient':
            profile = getattr(obj, 'profile', None)
            if profile:
                return profile.onboarding_completed
            return False
        return True

    def get_hospital_id(self, obj):
        if obj.user_type == 'patient':
            profile = getattr(obj, 'profile', None)
            if profile and profile.hospital_id:
                return profile.hospital_id
        if obj.user_type == 'provider':
            pp = getattr(obj, 'provider_profile', None)
            if pp:
                return pp.hospital_id
        return None

    def get_hospital_name(self, obj):
        hid = self.get_hospital_id(obj)
        if hid:
            try:
                return Hospital.objects.get(pk=hid).name
            except Hospital.DoesNotExist:
                return None
        return None
