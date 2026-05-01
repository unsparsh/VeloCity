from django.urls import path
from . import views

urlpatterns = [
    path('search/', views.search_locations, name='location-search'),
    path('reverse/', views.reverse_geocode, name='location-reverse'),
    path('driver-update/', views.update_driver_location, name='driver-location-update'),
    path('go-online/', views.go_online, name='driver-go-online'),
    path('go-offline/', views.go_offline, name='driver-go-offline'),
]
