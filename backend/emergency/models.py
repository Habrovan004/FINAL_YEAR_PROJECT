from django.db import models
from django.conf import settings

class EmergencyContact(models.Model):
    # Added Manager for IDE
    objects = models.Manager()

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='emergency_contacts')
    name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20)
    relationship = models.CharField(max_length=50, blank=True)
    is_primary = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} ({self.phone_number})"

class EmergencyLog(models.Model):
    objects = models.Manager()

    ACTION_CHOICES = [
        ('sos_trigger', 'One-Tap SOS Triggered'),
        ('call_emergency', 'Call Emergency Services'),
        ('call_hospital', 'Call Hospital'),
        ('call_partner', 'Call Partner'),
        ('share_location', 'Share Location'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='emergency_logs')
    # Link to the provider who received the alert
    provider_notified = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='received_sos_alerts')

    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    is_sms_sent = models.BooleanField(default=False)
    triggered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SOS by {self.user.full_name} at {self.triggered_at}"

class EmergencyInstruction(models.Model):
    objects = models.Manager()

    title = models.CharField(max_length=200)
    title_sw = models.CharField(max_length=200)
    text = models.TextField()
    text_sw = models.TextField()
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title
