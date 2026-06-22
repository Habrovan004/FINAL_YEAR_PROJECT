from rest_framework import serializers
from .models import EmergencyLog, EmergencyContact

class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = '__all__'
        read_only_fields = ['user']

class EmergencyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyLog
        fields = '__all__'
        read_only_fields = ['user', 'triggered_at']
