from rest_framework import serializers
from .models import User, Driver, Vehicle


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'firebase_uid', 'phone', 'email', 'full_name',
                  'profile_picture_url', 'is_active', 'created_at']
        read_only_fields = ['id', 'firebase_uid', 'created_at']


class UserRegisterSerializer(serializers.Serializer):
    firebase_uid = serializers.CharField(max_length=128)
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    full_name = serializers.CharField(max_length=100)

    def validate(self, data):
        if not data.get('phone') and not data.get('email'):
            raise serializers.ValidationError('Either phone or email is required.')
        return data

    def create(self, validated_data):
        return User.objects.create(**validated_data)


class DriverSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = ['id', 'firebase_uid', 'phone', 'email', 'full_name',
                  'profile_picture_url', 'license_number', 'is_verified',
                  'is_online', 'rating', 'total_rides', 'created_at']
        read_only_fields = ['id', 'firebase_uid', 'is_verified', 'rating',
                            'total_rides', 'created_at']


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ['id', 'make', 'model', 'year', 'color', 'license_plate',
                  'vehicle_type', 'battery_capacity_kwh', 'is_active']
        read_only_fields = ['id']
