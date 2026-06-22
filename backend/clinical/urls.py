from django.urls import path
from . import views

urlpatterns = [
    path('visits/', views.anc_visit_list, name='anc-visit-list'),
    path('summary/<int:patient_id>/', views.patient_summary, name='patient-summary'),
]
