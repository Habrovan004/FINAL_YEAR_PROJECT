from django.db import models
from django.conf import settings

class ChatSession(models.Model):
    # Track the current state of the rule-based screening
    STATE_CHOICES = [
        ('initial', 'Basic Screening'),
        ('checking_headache', 'Checking Headache Details'),
        ('checking_fetal_movement', 'Checking Fetal Movement'),
        ('checking_swelling', 'Checking Swelling'),
        ('risk_evaluated', 'Risk Evaluated'),
        ('escalated', 'Escalated to Provider'),
    ]
    
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bot_sessions')
    current_state = models.CharField(max_length=30, choices=STATE_CHOICES, default='initial')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Store temporary screening data
    collected_symptoms = models.JSONField(default=list, blank=True)
    risk_level = models.CharField(max_length=10, default='low')

    def __str__(self):
        return f"Bot Session: {self.patient.full_name} ({self.current_state})"

class BotMessage(models.Model):
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=10, choices=[('bot', 'AI Assistant'), ('patient', 'Patient')])
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sender}: {self.text[:50]}"
