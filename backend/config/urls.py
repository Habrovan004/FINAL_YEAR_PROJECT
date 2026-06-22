from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/patients/', include('patients.urls')),
    path('api/hospitals/', include('hospitals.urls')),
    path('api/tracking/', include('tracking.urls')),
    path('api/appointments/', include('appointments.urls')),
    path('api/clinical/', include('clinical.urls')),
    path('api/chatbot/', include('chatbot.urls')),
    path('api/medication/', include('medication.urls')),
    path('api/maintenance/', include('maintenance.urls')), # New Maintenance URLs
    path('api/tips/', include('tips.urls')),
    path('api/emergency/', include('emergency.urls')),
]
