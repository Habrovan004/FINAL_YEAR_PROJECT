from rest_framework import serializers
from .models import Appointment

class AppointmentSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source='hospital.name', read_only=True)
    visit_type_display = serializers.CharField(source='get_visit_type_display', read_only=True)
    patient_name = serializers.CharField(source='user.full_name', read_only=True)
    patient_phone = serializers.CharField(source='user.phone_number', read_only=True)

    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['user', 'created_at']
        # DRF auto-generates a UniqueValidator from Appointment's partial
        # UniqueConstraint, but that validator checks uniqueness across ALL
        # rows — it doesn't know about the constraint's `condition` (only
        # requested/upcoming rows are meant to reserve a slot). Left in
        # place, it would wrongly block rebooking a slot that a cancelled
        # appointment used to occupy. The view already enforces the correct
        # (status-aware) conflict check by hand, so disable the auto one.
        validators = []
