from rest_framework import serializers
from .models import MoodLog, Symptom

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
