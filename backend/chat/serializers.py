from rest_framework import serializers

from .models import ChatRoom, Message, VideoConsultation


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    is_own = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ('id', 'room', 'sender', 'sender_name', 'text', 'is_read', 'is_own', 'created_at')
        read_only_fields = ('id', 'sender', 'sender_name', 'is_read', 'is_own', 'created_at')

    def get_is_own(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        return user is not None and obj.sender_id == user.id


class ChatRoomSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    provider_name = serializers.CharField(source='provider.full_name', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = (
            'id', 'patient', 'patient_name', 'provider', 'provider_name',
            'created_at', 'is_active', 'last_message', 'unread_count',
        )
        read_only_fields = fields

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return {
            'text': msg.text,
            'sender_id': msg.sender_id,
            'created_at': msg.created_at.isoformat(),
        }

    def get_unread_count(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        if not user:
            return 0
        return obj.messages.filter(is_read=False).exclude(sender=user).count()


class VideoConsultationSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoConsultation
        fields = ('id', 'room', 'meeting_id', 'start_time', 'is_active')
        read_only_fields = ('id', 'start_time')
