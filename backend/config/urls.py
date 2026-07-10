from django.contrib import admin
from django.urls import path, include

import learn_views
from accounts.views import CookieTokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/auth/token/refresh/', CookieTokenRefreshView.as_view(), name='token-refresh'),
    path('api/patients/', include('patients.urls')),
    path('api/hospitals/', include('hospitals.urls')),
    path('api/tracking/', include('tracking.urls')),
    path('api/appointments/', include('appointments.urls')),
    path('api/clinical/', include('clinical.urls')),
    path('api/chatbot/', include('chatbot.urls')),
    path('api/chat/', include('chat.urls')),
    path('api/medication/', include('medication.urls')),
    path('api/maintenance/', include('maintenance.urls')),
    path('api/tips/', include('tips.urls')),
    path('api/emergency/', include('emergency.urls')),
    path('api/notifications/', include('notifications.urls')),

    # Canonical Learn endpoints (used by the patient Learn page and the
    # manager dashboard's content tab).
    path('api/learn/articles/', learn_views.articles_list, name='learn-articles'),
    path('api/learn/articles/<int:pk>/', learn_views.articles_detail, name='learn-article-detail'),
]
