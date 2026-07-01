from django.contrib import admin

from .models import ChatRoom, Message, VideoConsultation


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'patient', 'provider', 'created_at', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('patient__full_name', 'provider__full_name')


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'sender', 'is_read', 'created_at')
    list_filter = ('is_read',)


@admin.register(VideoConsultation)
class VideoConsultationAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'meeting_id', 'start_time', 'is_active')
    list_filter = ('is_active',)
