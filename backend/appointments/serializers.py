from rest_framework import serializers
from .models import Appointment

class AppointmentSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    visit_type_display = serializers.CharField(source='get_visit_type_display', read_only=True)

    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['user', 'created_at']
