from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('password-reset/request/', views.request_password_reset, name='password-reset-request'),
    path('password-reset/confirm/', views.confirm_password_reset, name='password-reset-confirm'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('me/', views.me, name='me'),

    # Provider Dashboard
    path('provider/dashboard/', views.provider_dashboard, name='provider-dashboard'),
]
