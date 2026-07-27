from rest_framework import serializers

from clinical.models import ANCVisit
from .models import ChatRoom, Message


class VisitCardSerializer(serializers.ModelSerializer):
    complications = serializers.CharField(source='get_complications_display', read_only=True)

    class Meta:
        model = ANCVisit
        fields = (
            'id', 'visit_date', 'gestational_age_weeks',
            'blood_pressure_systolic', 'blood_pressure_diastolic',
            'weight_kg', 'hemoglobin_g_dl', 'risk_level', 'complications',
            'next_appointment_date',
        )


class MessageSerializer(serializers.ModelSerializer):
    # SerializerMethodField (not source='sender.full_name') because `sender`
    # is None for system messages — a dotted `source` would raise
    # AttributeError trying to read `.full_name` off None.
    sender_name = serializers.SerializerMethodField()
    is_own = serializers.SerializerMethodField()
    # message_type/text/visit_card are all gated on deleted_for_everyone so a
    # deleted message's content never leaves the server, even though the
    # underlying row keeps its original values (soft delete only).
    message_type = serializers.SerializerMethodField()
    text = serializers.SerializerMethodField()
    visit_card = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            'id', 'room', 'sender', 'sender_name', 'message_type', 'text',
            'visit_card', 'is_read', 'read_at', 'is_own', 'created_at',
        )
        read_only_fields = fields

    def get_sender_name(self, obj):
        return obj.sender.full_name if obj.sender else 'System'

    def get_is_own(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        return user is not None and obj.sender_id == user.id

    def get_message_type(self, obj):
        return 'deleted' if obj.deleted_for_everyone else obj.message_type

    def get_text(self, obj):
        return '' if obj.deleted_for_everyone else obj.text

    def get_visit_card(self, obj):
        if obj.deleted_for_everyone or obj.message_type != 'visit_card' or not obj.visit:
            return None
        return VisitCardSerializer(obj.visit, context=self.context).data


class ChatRoomSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    provider_name = serializers.CharField(source='provider.full_name', read_only=True)
    provider_hospital = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = (
            'id', 'patient', 'patient_name', 'provider', 'provider_name',
            'provider_hospital', 'created_at', 'is_active', 'last_message', 'unread_count',
        )
        read_only_fields = fields

    def get_provider_hospital(self, obj):
        profile = getattr(obj.provider, 'provider_profile', None)
        hospital = getattr(profile, 'hospital', None)
        return hospital.name if hospital else None

    def get_last_message(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        qs = obj.messages.all()
        if user:
            qs = qs.exclude(hidden_for=user)
        msg = qs.order_by('-created_at').first()
        if not msg:
            return None
        return {
            'text': '' if msg.deleted_for_everyone else msg.text,
            'sender_id': msg.sender_id,
            'created_at': msg.created_at.isoformat(),
            'deleted': msg.deleted_for_everyone,
        }

    def get_unread_count(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        if not user:
            return 0
        return (
            obj.messages.filter(read_at__isnull=True)
            .exclude(sender=user)
            .exclude(hidden_for=user)
            .exclude(deleted_for_everyone=True)
            .count()
        )
