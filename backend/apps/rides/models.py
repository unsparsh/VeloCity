import uuid
from django.db import models
from apps.users.models import User, Driver, Vehicle


class Ride(models.Model):
    STATUS_CHOICES = [
        ('searching', 'Searching'),
        ('driver_assigned', 'Driver Assigned'),
        ('driver_arriving', 'Driver Arriving'),
        ('otp_verified', 'OTP Verified'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    CANCELLED_BY = [('user', 'User'), ('driver', 'Driver'), ('admin', 'Admin')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name='rides')
    driver = models.ForeignKey(Driver, null=True, blank=True, on_delete=models.SET_NULL, related_name='rides')
    vehicle = models.ForeignKey(Vehicle, null=True, blank=True, on_delete=models.SET_NULL)

    pickup_lat = models.DecimalField(max_digits=10, decimal_places=8)
    pickup_lng = models.DecimalField(max_digits=11, decimal_places=8)
    pickup_address = models.TextField()
    destination_lat = models.DecimalField(max_digits=10, decimal_places=8)
    destination_lng = models.DecimalField(max_digits=11, decimal_places=8)
    destination_address = models.TextField()
    route_polyline = models.TextField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='searching')

    otp_code = models.CharField(max_length=60, null=True, blank=True)
    otp_verified = models.BooleanField(default=False)
    otp_verified_at = models.DateTimeField(null=True, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)

    estimated_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    final_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    distance_km = models.DecimalField(max_digits=8, decimal_places=3, null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)
    pricing_breakdown = models.JSONField(null=True, blank=True)

    requested_at = models.DateTimeField(auto_now_add=True)
    driver_assigned_at = models.DateTimeField(null=True, blank=True)
    driver_arrived_at = models.DateTimeField(null=True, blank=True)
    ride_started_at = models.DateTimeField(null=True, blank=True)
    ride_completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancel_reason = models.TextField(null=True, blank=True)
    cancelled_by = models.CharField(max_length=10, choices=CANCELLED_BY, null=True, blank=True)

    user_rating = models.IntegerField(null=True, blank=True)
    driver_rating = models.IntegerField(null=True, blank=True)
    user_feedback = models.TextField(null=True, blank=True)
    driver_feedback = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rides'
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['driver']),
            models.Index(fields=['status']),
            models.Index(fields=['-requested_at']),
        ]

    def __str__(self):
        return f'Ride {self.id} [{self.status}]'


class RideDriverRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('expired', 'Expired'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='driver_requests')
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notified_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ride_driver_requests'
        unique_together = [('ride', 'driver')]
