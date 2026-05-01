import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.rides.models import Ride

from . import services
from .models import Payment, WalletTransaction
from .serializers import (
    PayRideSerializer,
    PaymentSerializer,
    RazorpayVerifySerializer,
    TopupOrderSerializer,
    WalletSerializer,
    WalletTransactionSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Wallet
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_wallet(request):
    wallet = services.get_or_create_wallet(request.user)
    recent = wallet.transactions.all()[:20]
    return Response({
        'wallet': WalletSerializer(wallet).data,
        'transactions': WalletTransactionSerializer(recent, many=True).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def topup_create_order(request):
    """Step 1 of wallet top-up: create a Razorpay order the client can pay."""
    s = TopupOrderSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=400)

    amount = s.validated_data['amount']
    wallet = services.get_or_create_wallet(request.user)
    receipt = f'topup_{wallet.id.hex[:12]}_{int(timezone.now().timestamp())}'
    order = services.create_razorpay_order(
        amount, receipt=receipt,
        notes={'user_id': str(request.user.id), 'purpose': 'wallet_topup'},
    )
    return Response({
        'order': order,
        'key_id': getattr(settings, 'RAZORPAY_KEY_ID', '') or 'MOCK_KEY',
        'amount_inr': str(amount),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def topup_verify(request):
    """Step 2 of wallet top-up: verify Razorpay signature and credit the wallet."""
    s = RazorpayVerifySerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=400)
    d = s.validated_data

    if not services.verify_razorpay_signature(
        d['razorpay_order_id'], d['razorpay_payment_id'], d['razorpay_signature']
    ):
        return Response({'error': 'Invalid payment signature.'}, status=400)

    # Prevent double-credit if the client retries.
    if WalletTransaction.objects.filter(
        description__contains=d['razorpay_payment_id']
    ).exists():
        wallet = services.get_or_create_wallet(request.user)
        return Response({'wallet': WalletSerializer(wallet).data, 'duplicate': True})

    amount_str = request.data.get('amount')
    if not amount_str:
        return Response({'error': 'amount is required.'}, status=400)
    try:
        amount = Decimal(str(amount_str))
    except Exception:
        return Response({'error': 'amount must be numeric.'}, status=400)
    if amount <= 0:
        return Response({'error': 'amount must be positive.'}, status=400)

    services.credit_wallet(
        request.user, amount, type='topup',
        description=f'Top-up · {d["razorpay_payment_id"]}',
    )
    wallet = services.get_or_create_wallet(request.user)
    return Response({'wallet': WalletSerializer(wallet).data})


# ---------------------------------------------------------------------------
# Ride payment
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ride_payment(request, ride_id):
    """Return the current payment for a ride (if any), for the owning user."""
    try:
        ride = Ride.objects.get(id=ride_id, user=request.user)
    except Ride.DoesNotExist:
        return Response({'error': 'Ride not found.'}, status=404)

    payment = ride.payments.order_by('-created_at').first()
    return Response({
        'ride_id': str(ride.id),
        'fare': str(ride.final_price or ride.estimated_price or 0),
        'status': ride.status,
        'payment': PaymentSerializer(payment).data if payment else None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pay_ride(request, ride_id):
    """Initiate payment for a completed ride using the chosen method."""
    s = PayRideSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=400)
    method = s.validated_data['method']

    try:
        ride = Ride.objects.get(id=ride_id, user=request.user)
    except Ride.DoesNotExist:
        return Response({'error': 'Ride not found.'}, status=404)

    if ride.status != 'completed':
        return Response({'error': 'Ride is not completed yet.'}, status=400)

    # Already paid? Surface the existing record idempotently.
    paid = ride.payments.filter(status='paid').first()
    if paid:
        return Response({'payment': PaymentSerializer(paid).data, 'already_paid': True})

    if method == 'wallet':
        try:
            payment = services.charge_ride_from_wallet(ride)
        except services.PaymentError as e:
            return Response({'error': str(e)}, status=400)
        return Response({'payment': PaymentSerializer(payment).data})

    # method == 'razorpay'
    amount = Decimal(ride.final_price or ride.estimated_price or 0)
    if amount <= 0:
        return Response({'error': 'Ride has no fare.'}, status=400)
    receipt = f'ride_{str(ride.id)[:18]}'
    order = services.create_razorpay_order(
        amount, receipt=receipt,
        notes={'ride_id': str(ride.id), 'user_id': str(request.user.id)},
    )
    # Persist pending payment tied to the order so /verify can find it.
    payment = Payment.objects.create(
        ride=ride, user=request.user, amount=amount,
        method='razorpay', status='pending',
        razorpay_order_id=order['id'],
    )
    return Response({
        'payment': PaymentSerializer(payment).data,
        'order': order,
        'key_id': getattr(settings, 'RAZORPAY_KEY_ID', '') or 'MOCK_KEY',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_ride_payment(request, ride_id):
    """Complete a Razorpay-method ride payment after the client receives the signature."""
    s = RazorpayVerifySerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=400)
    d = s.validated_data

    try:
        ride = Ride.objects.get(id=ride_id, user=request.user)
    except Ride.DoesNotExist:
        return Response({'error': 'Ride not found.'}, status=404)

    try:
        payment = Payment.objects.select_for_update().get(
            ride=ride, razorpay_order_id=d['razorpay_order_id'], method='razorpay',
        )
    except Payment.DoesNotExist:
        return Response({'error': 'No matching Razorpay order.'}, status=404)

    if payment.status == 'paid':
        return Response({'payment': PaymentSerializer(payment).data, 'already_paid': True})

    if not services.verify_razorpay_signature(
        d['razorpay_order_id'], d['razorpay_payment_id'], d['razorpay_signature']
    ):
        payment.status = 'failed'
        payment.failure_reason = 'Invalid signature'
        payment.save(update_fields=['status', 'failure_reason', 'updated_at'])
        return Response({'error': 'Invalid payment signature.'}, status=400)

    with transaction.atomic():
        payment.status = 'paid'
        payment.paid_at = timezone.now()
        payment.razorpay_payment_id = d['razorpay_payment_id']
        payment.razorpay_signature = d['razorpay_signature']
        payment.save(update_fields=[
            'status', 'paid_at', 'razorpay_payment_id', 'razorpay_signature', 'updated_at',
        ])
    return Response({'payment': PaymentSerializer(payment).data})
