from django.db import models
from django.conf import settings

class AuditLog(models.Model):
    # IDE Support
    objects = models.Manager()

    EVENT_TYPES = [
        ('login', 'User Login'),
        ('failed_login', 'Failed Login Attempt'),
        ('data_change', 'Data Modification'),
        ('security_alert', 'Security Alert'),
        ('backup', 'Database Backup'),
        ('system_update', 'System Update'),
        ('scheduled_task', 'Scheduled Task Run'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.get_event_type_display()} at {self.timestamp}"

class SystemMaintenance(models.Model):
    objects = models.Manager()

    last_backup_at = models.DateTimeField(null=True, blank=True)
    backup_status = models.CharField(max_length=20, default='pending')
    db_size_mb = models.FloatField(default=0.0)
    server_status = models.CharField(max_length=20, default='healthy')
    
    last_security_patch = models.DateField(null=True, blank=True)
    
    def __str__(self):
        return f"System Health: {self.server_status} (Last Backup: {self.last_backup_at})"
