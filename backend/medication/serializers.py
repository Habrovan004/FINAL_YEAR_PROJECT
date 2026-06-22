from rest_framework import serializers
from .models import Prescription, MedicationReminder

class MedicationReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationReminder
        fields = '__all__'

class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    provider_name = serializers.CharField(source='provider.full_name', read_only=True)
    reminders = MedicationReminderSerializer(many=True, read_only=True)

    class Meta:
        model = Prescription
        fields = '__all__'
        read_only_fields = ['provider', 'created_at']
