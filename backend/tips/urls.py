from django.urls import path
from . import views
urlpatterns = [
    path('', views.tip_list, name='tips'),
    path('categories/', views.categories, name='tip-categories'),
    path('<int:tip_id>/bookmark/', views.toggle_bookmark, name='toggle-bookmark'),
    path('saved/', views.saved_tips, name='saved-tips'),
]
