from django.db import models
from django.conf import settings


# ── New workflow schema: chatbot + escalation to provider ──────────────────
class Conversation(models.Model):
    """A chat thread between a mother and either the chatbot or a live provider.

    type='chatbot' until an escalation keyword is detected or the bot has no
    answer, after which it flips to type='provider' and the assigned provider
    joins. The full message history is preserved across the switch.
    """
    objects = models.Manager()

    TYPE_CHOICES = [
        ('chatbot', 'Chatbot'),
        ('provider', 'Provider'),
    ]

    mother = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations')
    provider = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='provider_conversations'
    )
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='chatbot')
    escalated_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Conversation #{self.pk} ({self.type}) — {self.mother.full_name}"


class Message(models.Model):
    objects = models.Manager()

    SENDER_TYPE_CHOICES = [
        ('chatbot', 'Health Assistant'),
        ('mother', 'Mother'),
        ('provider', 'Provider'),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages_v2')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='sent_messages'
    )
    sender_type = models.CharField(max_length=10, choices=SENDER_TYPE_CHOICES)
    content = models.TextField()
    triggered_escalation = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.sender_type}] {self.content[:50]}"
