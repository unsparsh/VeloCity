from django.urls import path
from . import views

urlpatterns = [
    # Passenger
    path('estimate-price/', views.estimate_price_view, name='ride-estimate-price'),
    path('request/', views.request_ride, name='ride-request'),
    path('history/', views.ride_history, name='ride-history'),
    path('frequent/', views.frequent_destinations, name='ride-frequent-destinations'),
    path('<uuid:ride_id>/', views.ride_detail, name='ride-detail'),
    path('<uuid:ride_id>/cancel/', views.cancel_ride, name='ride-cancel'),
    path('<uuid:ride_id>/driver-location/', views.driver_location, name='ride-driver-location'),
    path('<uuid:ride_id>/route/', views.get_ride_route, name='ride-route'),
    # Driver
    path('driver/pending/', views.driver_pending_rides, name='driver-pending-rides'),
    path('driver/active/', views.driver_active_ride, name='driver-active-ride'),
    path('driver/<uuid:ride_id>/accept/', views.driver_accept_ride, name='driver-accept-ride'),
    path('driver/<uuid:ride_id>/status/', views.driver_update_ride_status, name='driver-update-status'),
    path('driver/<uuid:ride_id>/verify-otp/', views.driver_verify_otp, name='driver-verify-otp'),
]
