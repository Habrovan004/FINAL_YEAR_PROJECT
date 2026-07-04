from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import F
from .models import User, OTPCode, ProviderProfile
from patients.models import PatientProfile
from hospitals.models import Hospital


def assign_least_loaded_provider(hospital):
    """Pick the available provider at this hospital with the lowest current_workload."""
    if not hospital:
        return None
    return (
        ProviderProfile.objects
        .filter(hospital=hospital, is_available=True)
        .order_by('current_workload')
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

        user = User.objects.create_user(**validated_data)
        user.is_verified = True
        user.save(update_fields=['is_verified'])

        if user.user_type == 'patient':
            # Auto-assign least-loaded provider at chosen facility
            assigned = assign_least_loaded_provider(hospital)
            profile = PatientProfile.objects.create(
                user=user,
                hospital=hospital,
                assigned_provider=assigned,
            )
            if assigned:
                ProviderProfile.objects.filter(pk=assigned.pk).update(
                    current_workload=F('current_workload') + 1
                )
            _ = profile

        elif user.user_type == 'provider':
            if not hospital:
                raise serializers.ValidationError({'hospital_id': 'Providers must be linked to a hospital.'})
            valid_specs = {'obstetrician', 'midwife', 'nurse'}
            if specialization not in valid_specs:
                specialization = 'nurse'
            ProviderProfile.objects.create(
                user=user,
                hospital=hospital,
                specialization=specialization,
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


class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    code = serializers.CharField(max_length=6)
