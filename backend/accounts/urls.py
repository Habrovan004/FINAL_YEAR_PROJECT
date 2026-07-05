from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('password-reset/', views.reset_password, name='password-reset'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('me/', views.me, name='me'),

    # Provider Dashboard
    path('provider/dashboard/', views.provider_dashboard, name='provider-dashboard'),
]
