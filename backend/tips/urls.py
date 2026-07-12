from django.urls import path
from . import views
urlpatterns = [
    path('<int:tip_id>/bookmark/', views.toggle_bookmark, name='toggle-bookmark'),
    path('saved/', views.saved_tips, name='saved-tips'),
]
