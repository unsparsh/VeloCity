import uuid
from django.db import models


class User(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firebase_uid = models.CharField(max_length=128, unique=True)
    phone = models.CharField(max_length=15, unique=True, null=True, blank=True)
    email = models.EmailField(max_length=254, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=100)
    profile_picture_url = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name} ({self.phone or self.email})'


class Driver(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firebase_uid = models.CharField(max_length=128, unique=True)
    phone = models.CharField(max_length=15, unique=True)
    email = models.EmailField(max_length=254, null=True, blank=True)
    full_name = models.CharField(max_length=100)
    profile_picture_url = models.TextField(null=True, blank=True)
    license_number = models.CharField(max_length=50, unique=True)
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_online = models.BooleanField(default=False)
    current_lat = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    current_lng = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    location_updated_at = models.DateTimeField(null=True, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    total_rides = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'drivers'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name} ({self.phone})'


class Vehicle(models.Model):
    VEHICLE_TYPES = [
        ('two_wheeler', 'Two Wheeler'),
        ('three_wheeler', 'Three Wheeler'),
        ('four_wheeler', 'Four Wheeler'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name='vehicles')
    make = models.CharField(max_length=50)
    model = models.CharField(max_length=50)
    year = models.IntegerField()
    color = models.CharField(max_length=30)
    license_plate = models.CharField(max_length=20, unique=True)
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPES)
    battery_capacity_kwh = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'vehicles'

    def __str__(self):
        return f'{self.year} {self.make} {self.model} ({self.license_plate})'
