from rest_framework import serializers

from .models import Payment, Wallet, WalletTransaction


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'amount', 'type', 'balance_after', 'ride',
            'payment', 'description', 'created_at',
        ]
        read_only_fields = fields


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ['id', 'balance', 'currency', 'updated_at']
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'ride', 'amount', 'currency', 'method', 'status',
            'razorpay_order_id', 'razorpay_payment_id', 'paid_at',
            'failure_reason', 'created_at',
        ]
        read_only_fields = fields


class TopupOrderSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=1)


class RazorpayVerifySerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()


class PayRideSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=['wallet', 'razorpay'])
