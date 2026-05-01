from rest_framework import serializers

from apps.users.models import Driver
from apps.rides.models import Ride
from apps.payments.models import Payment


class AdminDriverSerializer(serializers.ModelSerializer):
    vehicle = serializers.SerializerMethodField()

    class Meta:
        model = Driver
        fields = [
            'id', 'full_name', 'phone', 'email',
            'is_online', 'is_verified', 'is_active',
            'rating', 'total_rides', 'vehicle', 'created_at',
        ]

    def get_vehicle(self, obj):
        v = obj.vehicles.filter(is_active=True).first()
        if not v:
            return None
        return f'{v.year} {v.make} {v.model} · {v.license_plate}'


class AdminRideSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', default='')
    driver_name = serializers.SerializerMethodField()

    class Meta:
        model = Ride
        fields = [
            'id', 'user_name', 'driver_name',
            'pickup_address', 'destination_address',
            'status', 'estimated_price', 'final_price',
            'distance_km', 'requested_at',
        ]

    def get_driver_name(self, obj):
        return obj.driver.full_name if obj.driver else ''


class AdminPaymentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', default='')
    ride_id = serializers.UUIDField(source='ride.id')

    class Meta:
        model = Payment
        fields = [
            'id', 'user_name', 'ride_id',
            'amount', 'currency', 'method', 'status',
            'paid_at', 'created_at',
        ]
