from django.urls import path
from . import views
from . import manager_views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('password-reset/', views.reset_password, name='password-reset'),
    path('login/', views.login, name='login'),
    path('logout/', views.logout, name='logout'),
    path('me/', views.me, name='me'),
    path('partner/invite/', views.partner_link, name='partner-invite'),
    path('partner/accept/', views.accept_invitation, name='partner-accept'),

    # Provider Dashboard
    path('provider/dashboard/', views.provider_dashboard, name='provider-dashboard'),

    # Module 7 — Hospital Manager
    path('manager/stats/', manager_views.manager_stats, name='manager-stats'),
    path('manager/providers/', manager_views.manager_providers, name='manager-providers'),
    path('manager/providers/<int:pk>/', manager_views.manager_provider_detail, name='manager-provider-detail'),
    path('manager/content/', manager_views.manager_content, name='manager-content'),
    path('manager/content/<int:pk>/', manager_views.manager_content_detail, name='manager-content-detail'),
    path('manager/categories/', manager_views.manager_categories, name='manager-categories'),
    path('manager/mothers/', manager_views.manager_mothers, name='manager-mothers'),
]
