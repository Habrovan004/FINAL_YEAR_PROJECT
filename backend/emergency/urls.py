from django.urls import path
from . import views

urlpatterns = [
    path('trigger-sos/', views.trigger_sos, name='trigger-sos'),
    path('contacts/', views.contact_list, name='emergency-contacts'),
    path('hospitals/', views.emergency_hospitals, name='emergency-hospitals'),
]
