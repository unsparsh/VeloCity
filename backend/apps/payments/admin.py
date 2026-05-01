from django.contrib import admin

from .models import Payment, Wallet, WalletTransaction


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('user', 'balance', 'currency', 'updated_at')
    search_fields = ('user__phone', 'user__email', 'user__full_name')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ('wallet', 'type', 'amount', 'balance_after', 'ride', 'created_at')
    list_filter = ('type',)
    search_fields = ('wallet__user__phone', 'description')
    readonly_fields = tuple(f.name for f in WalletTransaction._meta.fields)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'ride', 'user', 'method', 'status', 'amount', 'paid_at')
    list_filter = ('status', 'method')
    search_fields = ('razorpay_order_id', 'razorpay_payment_id', 'user__phone')
    readonly_fields = ('id', 'created_at', 'updated_at', 'paid_at')
