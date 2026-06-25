from django.urls import path
from . import views

urlpatterns = [
    # New workflow endpoints
    path('conversation/', views.conversation_entry, name='conversation-entry'),
    path('conversation/<int:conversation_id>/messages/', views.conversation_messages, name='conversation-messages'),
    path('message/', views.post_message, name='post-message'),
    path('provider/queue/', views.provider_queue, name='provider-queue'),
    path('provider/reply/', views.provider_reply, name='provider-reply'),

    # Legacy
    path('chat/', views.bot_chat, name='bot-chat'),
    path('history/', views.chat_history, name='bot-history'),
]
