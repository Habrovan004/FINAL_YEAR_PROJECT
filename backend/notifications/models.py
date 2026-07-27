from django.db import models
from django.conf import settings


class Notification(models.Model):
    """Minimal in-app notification, polled by the frontend like everything
    else in this codebase (no push infra exists). Created for a chat message
    or an appointment status change directed at the other party."""

    VERB_CHOICES = [
        ('chat_message', 'New chat message'),
        ('appointment_requested', 'Appointment requested'),
        ('appointment_confirmed', 'Appointment confirmed'),
        ('appointment_declined', 'Appointment declined'),
        ('appointment_time_proposed', 'Appointment new time proposed'),
        ('appointment_cancelled', 'Appointment cancelled'),
        ('chat_escalated', 'Chat escalated to provider'),
    ]

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    verb = models.CharField(max_length=30, choices=VERB_CHOICES)
    message = models.TextField()
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_verb_display()} -> {self.recipient.full_name}"
