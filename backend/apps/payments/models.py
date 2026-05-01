import uuid
from decimal import Decimal
from django.db import models

from apps.users.models import User
from apps.rides.models import Ride


class Wallet(models.Model):
    """Per-user stored-value wallet, denominated in INR by default."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='wallet')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=3, default='INR')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallets'

    def __str__(self):
        return f'Wallet {self.user_id} · {self.currency} {self.balance}'


class WalletTransaction(models.Model):
    """Immutable ledger entry for every wallet credit/debit."""

    TYPE_CHOICES = [
        ('topup', 'Top-up'),
        ('ride_debit', 'Ride Debit'),
        ('refund', 'Refund'),
        ('adjust', 'Adjustment'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    # Positive=credit, Negative=debit. Signed for easy sum checks.
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    ride = models.ForeignKey(Ride, null=True, blank=True, on_delete=models.SET_NULL, related_name='wallet_transactions')
    payment = models.ForeignKey(
        'Payment', null=True, blank=True, on_delete=models.SET_NULL, related_name='wallet_transactions'
    )
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wallet_transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['wallet', '-created_at']),
            models.Index(fields=['ride']),
        ]

    def __str__(self):
        return f'{self.type} {self.amount} → bal {self.balance_after}'


class Payment(models.Model):
    """A single attempt to collect fare for a ride, via wallet or razorpay."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    METHOD_CHOICES = [
        ('wallet', 'Wallet'),
        ('razorpay', 'Razorpay'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='payments')
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='INR')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    razorpay_order_id = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=100, null=True, blank=True)
    razorpay_signature = models.CharField(max_length=255, null=True, blank=True)

    failure_reason = models.CharField(max_length=255, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ride']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'Payment {self.id} · {self.method} · {self.status} · {self.amount}'
