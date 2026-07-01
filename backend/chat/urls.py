from django.urls import path

from . import views

urlpatterns = [
    path('rooms/', views.rooms, name='chat-rooms'),
    path('rooms/<int:room_id>/messages/', views.messages, name='chat-messages'),
    path('rooms/<int:room_id>/mark-read/', views.mark_read, name='chat-mark-read'),
]
