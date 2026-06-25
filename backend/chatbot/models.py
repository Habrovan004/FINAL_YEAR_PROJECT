from django.db import models
from django.conf import settings


# ── Legacy state-machine session (kept to avoid breaking older code paths) ──
class ChatSession(models.Model):
    objects = models.Manager()

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
    collected_symptoms = models.JSONField(default=list, blank=True)
    risk_level = models.CharField(max_length=10, default='low')

    def __str__(self):
        return f"Bot Session: {self.patient.full_name} ({self.current_state})"


class BotMessage(models.Model):
    objects = models.Manager()

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=10, choices=[('bot', 'AI Assistant'), ('patient', 'Patient')])
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sender}: {self.text[:50]}"


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
