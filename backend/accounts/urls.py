from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('password-reset/request/', views.request_password_reset, name='password-reset-request'),
    path('password-reset/confirm/', views.confirm_password_reset, name='password-reset-confirm'),
    path('send-otp/', views.send_otp, name='send_otp'),
    path('verify-otp/', views.verify_otp, name='verify_otp'),
    path('login/', views.login, name='login'),
    path('me/', views.me, name='me'),
    path('partner/invite/', views.partner_link, name='partner-invite'),
    path('partner/accept/', views.accept_invitation, name='partner-accept'),
    
    # Module 10: Provider Dashboard
    path('provider/dashboard/', views.provider_dashboard, name='provider-dashboard'),
]
