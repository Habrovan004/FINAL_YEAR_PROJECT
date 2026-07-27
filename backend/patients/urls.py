from django.urls import path
from . import views

urlpatterns = [
    path('', views.patient_list, name='patient-list'),
    path('<int:patient_id>/', views.patient_detail, name='patient-detail'),
    path('<int:patient_id>/available-providers/', views.available_providers_for_reassignment, name='patient-available-providers'),
    path('<int:patient_id>/reassign/', views.reassign_patient, name='patient-reassign'),
    path('profile/', views.profile, name='patient-profile'),
    path('complete-onboarding/', views.complete_onboarding, name='complete-onboarding'),
    path('pregnancy-info/', views.pregnancy_info, name='pregnancy-info'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('skip-onboarding/', views.skip_onboarding, name='skip-onboarding'),
    path('baby-growth/', views.baby_growth, name='baby-growth'),
]
