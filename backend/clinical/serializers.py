from rest_framework import serializers
from .models import ANCVisit

class ANCVisitSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    provider_name = serializers.CharField(source='provider.full_name', read_only=True)
    complications_display = serializers.CharField(source='get_complications_display', read_only=True)

    class Meta:
        model = ANCVisit
        fields = '__all__'
        read_only_fields = ['provider', 'visit_date', 'recommendations']
