from django.urls import path
from . import views

urlpatterns = [
    # Health check for the chat header badge (public — no auth needed so the
    # mother can see status before logging in / opening a conversation).
    path('status/', views.chatbot_status, name='chatbot-status'),

    # New workflow endpoints
    path('conversation/', views.conversation_entry, name='conversation-entry'),
    path('conversation/<int:conversation_id>/messages/', views.conversation_messages, name='conversation-messages'),
    path('message/', views.post_message, name='post-message'),
    path('provider/queue/', views.provider_queue, name='provider-queue'),
    path('provider/reply/', views.provider_reply, name='provider-reply'),
    path('provider/insert-visit/', views.provider_insert_visit_summary, name='provider-insert-visit'),
]
