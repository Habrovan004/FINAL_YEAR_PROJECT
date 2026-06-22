from django.urls import path
from . import views

urlpatterns = [
    path('audit-logs/', views.system_audit_logs, name='audit-logs'),
    path('status/', views.maintenance_status, name='maintenance-status'),
    path('recovery/', views.account_recovery, name='account-recovery'),
    path('resources/', views.server_resources, name='server-resources'),
]
