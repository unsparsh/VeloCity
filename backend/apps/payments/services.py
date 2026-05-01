"""Business logic for the payments app.

Split out from views so that tests, admin actions, and scheduled tasks can
reuse the same primitives.
"""
from __future__ import annotations

import hmac
import hashlib
import logging
import secrets
from decimal import Decimal
from typing import Optional

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.rides.models import Ride
from apps.users.models import User

from .models import Payment, Wallet, WalletTransaction

logger = logging.getLogger(__name__)


class PaymentError(Exception):
    """Raised for user-visible payment errors (insufficient funds, etc.)."""


# ---------------------------------------------------------------------------
# Wallet primitives
# ---------------------------------------------------------------------------

def get_or_create_wallet(user: User) -> Wallet:
    wallet, _ = Wallet.objects.get_or_create(user=user)
    return wallet


@transaction.atomic
def _apply_wallet_delta(
    *,
    user: User,
    delta: Decimal,
    type: str,
    description: str = '',
    ride: Optional[Ride] = None,
    payment: Optional[Payment] = None,
) -> WalletTransaction:
    """Apply a signed delta to the wallet and write a ledger entry.

    Uses SELECT FOR UPDATE so concurrent requests serialize correctly.
    """
    wallet = (
        Wallet.objects.select_for_update()
        .select_related('user')
        .filter(user=user)
        .first()
    )
    if wallet is None:
        wallet = Wallet.objects.create(user=user)
        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

    new_balance = wallet.balance + delta
    if new_balance < 0:
        raise PaymentError('Insufficient wallet balance.')

    wallet.balance = new_balance
    wallet.save(update_fields=['balance', 'updated_at'])

    return WalletTransaction.objects.create(
        wallet=wallet,
        amount=delta,
        type=type,
        balance_after=new_balance,
        ride=ride,
        payment=payment,
        description=description[:255],
    )


def credit_wallet(user, amount: Decimal, *, type: str = 'topup', description: str = '',
                  ride=None, payment=None) -> WalletTransaction:
    if amount <= 0:
        raise PaymentError('Credit amount must be positive.')
    return _apply_wallet_delta(
        user=user, delta=Decimal(amount), type=type,
        description=description, ride=ride, payment=payment,
    )


def debit_wallet(user, amount: Decimal, *, type: str = 'ride_debit', description: str = '',
                 ride=None, payment=None) -> WalletTransaction:
    if amount <= 0:
        raise PaymentError('Debit amount must be positive.')
    return _apply_wallet_delta(
        user=user, delta=-Decimal(amount), type=type,
        description=description, ride=ride, payment=payment,
    )


# ---------------------------------------------------------------------------
# Ride fare collection
# ---------------------------------------------------------------------------

def _ride_fare(ride: Ride) -> Decimal:
    amount = ride.final_price or ride.estimated_price
    if amount is None:
        raise PaymentError('Ride has no fare set.')
    return Decimal(amount)


@transaction.atomic
def charge_ride_from_wallet(ride: Ride) -> Payment:
    """Synchronous wallet debit for a completed ride."""
    if ride.status != 'completed':
        raise PaymentError('Ride must be completed before payment.')

    # Deduplicate: if a successful payment already exists, return it.
    existing = ride.payments.filter(status='paid').first()
    if existing:
        return existing

    amount = _ride_fare(ride)
    payment = Payment.objects.create(
        ride=ride, user=ride.user, amount=amount, method='wallet', status='pending',
    )
    try:
        debit_wallet(
            ride.user, amount, type='ride_debit',
            description=f'Ride {ride.id}', ride=ride, payment=payment,
        )
    except PaymentError as e:
        payment.status = 'failed'
        payment.failure_reason = str(e)
        payment.save(update_fields=['status', 'failure_reason', 'updated_at'])
        raise

    payment.status = 'paid'
    payment.paid_at = timezone.now()
    payment.save(update_fields=['status', 'paid_at', 'updated_at'])
    return payment


# ---------------------------------------------------------------------------
# Razorpay integration (mockable for local dev)
# ---------------------------------------------------------------------------

def _razorpay_configured() -> bool:
    return bool(getattr(settings, 'RAZORPAY_KEY_ID', '') and getattr(settings, 'RAZORPAY_KEY_SECRET', ''))


def create_razorpay_order(amount: Decimal, *, receipt: str, notes: Optional[dict] = None) -> dict:
    """Create a Razorpay order. If keys aren't configured, return a mock order.

    Amounts are in rupees in our domain; Razorpay takes paise.
    """
    amount_paise = int(Decimal(amount) * 100)

    if not _razorpay_configured():
        # Mock mode for local dev — still deterministic enough to exercise the flow.
        mock_id = f'order_MOCK{secrets.token_hex(8)}'
        logger.info('Razorpay not configured; returning mock order %s', mock_id)
        return {
            'id': mock_id,
            'amount': amount_paise,
            'currency': 'INR',
            'receipt': receipt,
            'status': 'created',
            'notes': notes or {},
            'mock': True,
        }

    # Lazy import so local dev doesn't need the SDK installed.
    import razorpay  # type: ignore

    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    order = client.order.create({
        'amount': amount_paise,
        'currency': 'INR',
        'receipt': receipt,
        'payment_capture': 1,
        'notes': notes or {},
    })
    return dict(order)


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Validate the HMAC-SHA256 signature returned by Razorpay Checkout."""
    if not _razorpay_configured():
        # Accept any signature that starts with 'MOCK' in dev mode.
        return bool(signature) and signature.startswith('MOCK')

    secret = settings.RAZORPAY_KEY_SECRET.encode()
    body = f'{order_id}|{payment_id}'.encode()
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
