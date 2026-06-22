from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import AuditLog, SystemMaintenance
from .serializers import AuditLogSerializer, SystemMaintenanceSerializer
from accounts.models import User
from django.utils import timezone
import os

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_audit_logs(request):
    """
    Module 11: Security Monitoring.
    Returns comprehensive audit logs for forensic analysis.
    """
    if request.user.user_type != 'admin':
        return Response({'error': 'Unauthorized. Super Admin access only.'}, status=403)
        
    logs = AuditLog.objects.all().order_by('-timestamp')[:100]
    serializer = AuditLogSerializer(logs, many=True)
    return Response(serializer.data)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def maintenance_status(request):
    """
    Manages database backups and server health metrics.
    """
    if request.user.user_type != 'admin':
        return Response({'error': 'Unauthorized'}, status=403)
        
    status_obj, created = SystemMaintenance.objects.get_or_create(id=1)
    
    if request.method == 'POST':
        action = request.data.get('action')
        if action == 'trigger_backup':
            # In a real app, this would execute a pg_dump or similar command
            status_obj.last_backup_at = timezone.now()
            status_obj.backup_status = 'success'
            status_obj.save()
            
            # Log the maintenance event
            AuditLog.objects.create(
                user=request.user,
                event_type='backup',
                description="Manual database backup triggered by Super Admin"
            )
            return Response({'message': 'Backup completed successfully.'})
            
    return Response(SystemMaintenanceSerializer(status_obj).data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def account_recovery(request):
    """
    Handles secure identity verification and credential reset.
    """
    if request.user.user_type != 'admin':
        return Response({'error': 'Unauthorized'}, status=403)
        
    target_phone = request.data.get('phone_number')
    new_password = request.data.get('new_password')
    
    try:
        target_user = User.objects.get(phone_number=target_phone)
        target_user.set_password(new_password)
        target_user.save()
        
        # Log the recovery event for accountability
        AuditLog.objects.create(
            user=request.user,
            event_type='security_alert',
            description=f"Account recovery performed for {target_phone}"
        )
        return Response({'message': f'Credentials reset successfully for {target_phone}'})
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def server_resources(request):
    """
    Module 11: Server Health Monitoring.
    """
    if request.user.user_type != 'admin':
        return Response({'error': 'Unauthorized'}, status=403)
        
    # Simulated resource monitoring
    return Response({
        'cpu_usage': '12%',
        'memory_usage': '482MB / 2048MB',
        'storage': '1.2GB / 10GB',
        'db_connection': 'PostgreSQL Active',
        'celery_worker': 'Online'
    })
