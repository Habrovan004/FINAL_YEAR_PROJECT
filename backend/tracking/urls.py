from django.urls import path
from . import views

urlpatterns = [
    path('', views.mood_logs, name='mood-logs'),
    path('timeline/', views.timeline, name='timeline'),
    path('symptoms/', views.symptom_list, name='symptom-list'),
]
