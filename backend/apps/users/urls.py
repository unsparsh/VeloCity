from django.urls import path
from . import views

urlpatterns = [
    # Passenger
    path('register/', views.register, name='auth-register'),
    path('me/', views.me, name='auth-me'),
    path('me/update/', views.update_profile, name='auth-update-profile'),
    # Driver
    path('driver/register/', views.register_driver, name='driver-register'),
    path('driver/me/', views.driver_me, name='driver-me'),
]
