from django.urls import path
from . import views

urlpatterns = [
    path('prescriptions/', views.prescription_list, name='prescription-list'),
    path('reminders/<int:reminder_id>/acknowledge/', views.acknowledge_reminder, name='acknowledge-reminder'),
    path('compliance/<int:patient_id>/', views.compliance_report, name='compliance-report'),
]
