from rest_framework import serializers
from .models import AuditLog, SystemMaintenance

class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.full_name', read_only=True)
    event_display = serializers.CharField(source='get_event_type_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = '__all__'

class SystemMaintenanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemMaintenance
        fields = '__all__'
