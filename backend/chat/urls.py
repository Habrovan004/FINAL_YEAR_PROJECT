from django.urls import path

from . import views

urlpatterns = [
    path('rooms/', views.rooms, name='chat-rooms'),
    path('rooms/<int:room_id>/messages/', views.messages, name='chat-messages'),
    path('rooms/<int:room_id>/mark-read/', views.mark_read, name='chat-mark-read'),
    path('unread-count/', views.unread_count, name='chat-unread-count'),
    path('messages/delete/', views.delete_messages, name='chat-messages-delete'),
]
