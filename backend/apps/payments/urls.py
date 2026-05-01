from django.urls import path

from . import views

urlpatterns = [
    # Wallet
    path('wallet/', views.get_wallet, name='wallet-detail'),
    path('wallet/topup/order/', views.topup_create_order, name='wallet-topup-order'),
    path('wallet/topup/verify/', views.topup_verify, name='wallet-topup-verify'),

    # Ride payment
    path('ride/<uuid:ride_id>/', views.ride_payment, name='ride-payment-detail'),
    path('ride/<uuid:ride_id>/pay/', views.pay_ride, name='ride-pay'),
    path('ride/<uuid:ride_id>/verify/', views.verify_ride_payment, name='ride-pay-verify'),
]
