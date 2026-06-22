from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User, OTPCode, PartnerLink
from patients.models import PatientProfile

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['phone_number', 'full_name', 'date_of_birth', 'user_type', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        # Automatically create a PatientProfile if the user is a patient
        if user.user_type == 'patient':
            PatientProfile.objects.create(user=user)
        return user

class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['phone_number'], password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid phone number or password.')
        
        # Add is_verified check
        if not user.is_verified:
            raise serializers.ValidationError('Account not verified.')

        tokens = RefreshToken.for_user(user)
        user_data = UserSerializer(user).data
        return {
            'user': user_data,
            'access': str(tokens.access_token),
            'refresh': str(tokens),
        }

class UserSerializer(serializers.ModelSerializer):
    is_onboarded = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'phone_number', 'full_name', 'user_type', 'date_of_birth', 'is_verified', 'is_onboarded']
    
    def get_is_onboarded(self, obj):
        """Check if user has completed onboarding (hospital selection)"""
        if obj.user_type == 'patient':
            # Use safe retrieval to avoid 500 errors if profile is missing
            profile = getattr(obj, 'profile', None)
            if profile:
                return profile.onboarding_completed
            return False
        # Non-patients are considered onboarded
        return True

class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    code = serializers.CharField(max_length=6)

class PartnerLinkSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    partner_name = serializers.CharField(source='partner.full_name', read_only=True)

    class Meta:
        model = PartnerLink
        fields = '__all__'
        read_only_fields = ['patient', 'partner', 'invitation_code', 'is_confirmed']