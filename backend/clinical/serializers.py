from rest_framework import serializers
from .models import ANCVisit


class ANCVisitSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    provider_name = serializers.CharField(source='provider.full_name', read_only=True)
    complications_display = serializers.CharField(source='get_complications_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)

    class Meta:
        model = ANCVisit
        fields = '__all__'
        read_only_fields = [
            'provider', 'visit_date',
            'recommendations', 'risk_reasons', 'auto_risk_level',
        ]

    def validate(self, attrs):
        override = attrs.get(
            'risk_level_override',
            getattr(self.instance, 'risk_level_override', False),
        )
        if override:
            reason = attrs.get(
                'risk_level_override_reason',
                getattr(self.instance, 'risk_level_override_reason', ''),
            )
            if not (reason or '').strip():
                raise serializers.ValidationError({
                    'risk_level_override_reason':
                        'Please give a brief reason for overriding the auto-computed risk level.',
                })
        return attrs

    def validate_blood_pressure_systolic(self, value):
        if value < 60 or value > 250:
            raise serializers.ValidationError("Systolic BP must be between 60 and 250 mmHg.")
        return value

    def validate_blood_pressure_diastolic(self, value):
        if value < 30 or value > 150:
            raise serializers.ValidationError("Diastolic BP must be between 30 and 150 mmHg.")
        return value

    def validate_gestational_age_weeks(self, value):
        if value < 0 or value > 45:
            raise serializers.ValidationError("Gestational age must be between 0 and 45 weeks.")
        return value

    def validate_weight_kg(self, value):
        if value < 25 or value > 250:
            raise serializers.ValidationError("Weight must be between 25 and 250 kg.")
        return value

    def validate_hemoglobin_g_dl(self, value):
        if value is None:
            return value
        if value < 2 or value > 25:
            raise serializers.ValidationError("Hemoglobin must be between 2 and 25 g/dL.")
        return value

    def validate_fetal_heart_rate_bpm(self, value):
        if value is None:
            return value
        if value < 40 or value > 220:
            raise serializers.ValidationError("Fetal heart rate must be between 40 and 220 bpm.")
        return value

    def validate_fundal_height_cm(self, value):
        if value is None:
            return value
        if value < 5 or value > 60:
            raise serializers.ValidationError("Fundal height must be between 5 and 60 cm.")
        return value
