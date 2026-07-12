from rest_framework import serializers
from .models import MoodLog, Symptom, SymptomReport

class SymptomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Symptom
        fields = '__all__'

class MoodLogSerializer(serializers.ModelSerializer):
    mood_label = serializers.CharField(source='get_mood_display', read_only=True)

    class Meta:
        model = MoodLog
        fields = '__all__'
        read_only_fields = ['user', 'logged_at', 'date']

    def to_representation(self, instance):
        # `symptoms` is stored as a raw JSONField list of Symptom IDs (that's
        # what TrackPage.tsx posts) — resolve to display names here so the
        # Timeline journal/chart don't render bare numbers.
        data = super().to_representation(instance)
        symptom_ids = [s for s in (instance.symptoms or []) if isinstance(s, int)]
        names = {s.id: s.name for s in Symptom.objects.filter(id__in=symptom_ids)}
        data['symptoms'] = [names.get(s, s) for s in (instance.symptoms or [])]
        return data

class SymptomReportSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    symptom_details = SymptomSerializer(source='symptoms', many=True, read_only=True)
    risk_display = serializers.CharField(source='get_risk_level_display', read_only=True)

    class Meta:
        model = SymptomReport
        fields = '__all__'
        read_only_fields = ['patient', 'risk_level', 'clinical_recommendation', 'created_at', 'is_reviewed']
