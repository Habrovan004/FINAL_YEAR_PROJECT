from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.bot_chat, name='bot-chat'),
    path('history/', views.chat_history, name='bot-history'),
]
