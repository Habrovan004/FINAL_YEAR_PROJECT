from django.urls import path
from . import views

urlpatterns = [
    path('', views.mood_logs, name='mood-logs'),
    path('timeline/', views.timeline, name='timeline'),
    path('symptoms/', views.symptom_list, name='symptom-list'),
    path('reports/', views.submit_symptom_report, name='submit-symptom-report'),
    path('reports/<int:patient_id>/', views.provider_patient_reports, name='provider-patient-reports'),
]
