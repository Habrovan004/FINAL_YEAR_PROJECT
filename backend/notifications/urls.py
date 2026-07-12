from django.urls import path

from . import views

urlpatterns = [
    path('', views.notification_list, name='notification-list'),
    path('mark-all-read/', views.mark_all_read, name='notification-mark-all-read'),
]
