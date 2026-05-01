from django.urls import path
from . import views

urlpatterns = [
    path('stats/', views.StatsView.as_view(), name='admin-stats'),
    path('rides/', views.AdminRidesView.as_view(), name='admin-rides'),
    path('drivers/', views.AdminDriversView.as_view(), name='admin-drivers'),
    path('payments/', views.AdminPaymentsView.as_view(), name='admin-payments'),
]
