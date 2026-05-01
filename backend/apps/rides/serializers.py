from rest_framework import serializers
from .models import Ride


class RideSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.full_name', read_only=True, default=None)
    driver_phone = serializers.CharField(source='driver.phone', read_only=True, default=None)
    driver_avg_rating = serializers.DecimalField(
        source='driver.rating', max_digits=3, decimal_places=2, read_only=True, default=None
    )
    vehicle_info = serializers.SerializerMethodField()
    user_name = serializers.CharField(source='user.full_name', read_only=True, default=None)
    user_phone = serializers.CharField(source='user.phone', read_only=True, default=None)

    class Meta:
        model = Ride
        fields = [
            'id', 'status',
            'pickup_lat', 'pickup_lng', 'pickup_address',
            'destination_lat', 'destination_lng', 'destination_address',
            'estimated_price', 'final_price', 'distance_km', 'duration_minutes',
            'pricing_breakdown', 'otp_code', 'otp_verified',
            'driver_name', 'driver_phone', 'driver_avg_rating', 'vehicle_info',
            'user_name', 'user_phone',
            'requested_at', 'driver_assigned_at', 'ride_started_at', 'ride_completed_at',
        ]

    def get_vehicle_info(self, obj):
        if not obj.vehicle:
            return None
        return {
            'make': obj.vehicle.make,
            'model': obj.vehicle.model,
            'color': obj.vehicle.color,
            'license_plate': obj.vehicle.license_plate,
            'vehicle_type': obj.vehicle.vehicle_type,
        }


class EstimatePriceSerializer(serializers.Serializer):
    pickup_lat = serializers.FloatField()
    pickup_lng = serializers.FloatField()
    destination_lat = serializers.FloatField()
    destination_lng = serializers.FloatField()


class RequestRideSerializer(serializers.Serializer):
    pickup_lat = serializers.FloatField()
    pickup_lng = serializers.FloatField()
    pickup_address = serializers.CharField(max_length=500)
    destination_lat = serializers.FloatField()
    destination_lng = serializers.FloatField()
    destination_address = serializers.CharField(max_length=500)
