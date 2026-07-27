from django.db import models
from django.conf import settings

class ChatRoom(models.Model):
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='patient_rooms')
    provider = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='provider_rooms')
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('patient', 'provider')

    def __str__(self):
        return f"Chat: {self.patient.full_name} & {self.provider.full_name}"

class Message(models.Model):
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('system', 'System'),
        ('visit_card', 'ANC Visit Card'),
    ]

    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    # Nullable for system messages (e.g. a provider-reassignment notice) —
    # SET_NULL (not CASCADE) so a deleted user account doesn't take their
    # message history with it, matching chatbot.Message's sender field.
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default='text')
    text = models.TextField(blank=True)
    # Set when message_type='visit_card' — the ANC visit being shared into
    # the chat. SET_NULL so the card's text caption still renders even if
    # the underlying visit is later deleted.
    visit = models.ForeignKey(
        'clinical.ANCVisit', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='chat_mentions',
    )
    # `is_read` kept for the existing mark-read flow; `read_at` is the
    # timestamped version added for the incremental-polling read-receipt
    # behaviour landing in the next task — both are updated together once
    # that view logic changes.
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # ── Soft delete — content is never physically removed from the row ──
    # "Delete for everyone": the sender's own message, blanked in every
    # participant's view. Original `message_type`/`text`/`visit` stay intact
    # in the database (clinical-record retention); only the serializer gates
    # on this flag to output type "deleted" with an empty body.
    deleted_for_everyone = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='deleted_chat_messages',
    )
    # "Delete for me": hides the message from one participant's own fetches
    # only — the other party's view is completely unaffected. A chat room
    # only ever has two participants, so a plain M2M (no through-table
    # timestamp needed) is more than sufficient.
    hidden_for = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name='hidden_chat_messages',
    )

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        sender_label = self.sender.full_name if self.sender else 'System'
        return f"From {sender_label} at {self.created_at}"


class ChatNudge(models.Model):
    """Records that a provider has already been sent one unread-message SMS
    nudge for a given room on a given day — the de-dup guard for
    `chat.tasks.send_unread_chat_nudges`. One row per (room, day) sent."""
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='nudges')
    sent_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('room', 'sent_date')

    def __str__(self):
        return f"Nudge for room {self.room_id} on {self.sent_date}"
