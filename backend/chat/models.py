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
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"From {self.sender.full_name} at {self.created_at}"

class VideoConsultation(models.Model):
    room = models.OneToOneField(ChatRoom, on_delete=models.CASCADE, related_name='video_call')
    meeting_id = models.CharField(max_length=100, unique=True)
    start_time = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Video: {self.room.patient.full_name}"
