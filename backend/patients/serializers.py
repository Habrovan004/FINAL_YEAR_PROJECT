from rest_framework import serializers
from .models import PatientProfile, BabyGrowth, ANCMilestone
from hospitals.models import Hospital # Import Hospital model

class PatientProfileSerializer(serializers.ModelSerializer):
    pregnancy_week = serializers.SerializerMethodField()
    trimester = serializers.SerializerMethodField()
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    provider_name = serializers.CharField(source='assigned_provider.user.full_name', read_only=True, allow_null=True)
    is_onboarded = serializers.SerializerMethodField()

    # Accept both 'hospital' and 'hospital_id' for flexibility
    hospital = serializers.PrimaryKeyRelatedField(queryset=Hospital.objects.all(), required=False, allow_null=True)

    class Meta:
        model = PatientProfile
        fields = '__all__'
        read_only_fields = ['user', 'created_at', 'updated_at', 'assigned_provider']

    def get_pregnancy_week(self, obj):
        return obj.pregnancy_week()

    def get_trimester(self, obj):
        return obj.trimester()

    def get_is_onboarded(self, obj):
        return obj.onboarding_completed

    def validate_previous_complications(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Must be a list.")
        for item in value:
            if not isinstance(item, str):
                raise serializers.ValidationError("Each entry must be a string.")
            if len(item) > 200:
                raise serializers.ValidationError("Each entry must be 200 characters or fewer.")
        return value

class BabyGrowthSerializer(serializers.ModelSerializer):
    trimester = serializers.SerializerMethodField()

    class Meta:
        model = BabyGrowth
        fields = '__all__'

    def get_trimester(self, obj):
        return obj.trimester()

class ANCMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ANCMilestone
        fields = '__all__'
