import math
import secrets
from datetime import timedelta

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.users.authentication.firebase import (
    DriverFirebaseAuthentication,
    UniversalFirebaseAuthentication,
)
from .models import Ride
from .serializers import RideSerializer, EstimatePriceSerializer, RequestRideSerializer
from .services.redis_pipeline import (
    cache_ride,
    publish_ride_request,
    invalidate_ride_cache,
)


OTP_TTL_MINUTES = 10


def _generate_otp() -> str:
    """Return a cryptographically random 4-digit OTP."""
    return f'{secrets.randbelow(10000):04d}'


def _haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _calc_price(distance_km):
    BASE = 30.0
    PER_KM = 12.0
    PER_MIN = 1.5
    duration = distance_km / 30 * 60
    price = BASE + (distance_km * PER_KM) + (duration * PER_MIN)
    return round(price, 2), {
        'base_fare': BASE,
        'distance_charge': round(distance_km * PER_KM, 2),
        'time_charge': round(duration * PER_MIN, 2),
        'distance_km': round(distance_km, 2),
        'duration_minutes': round(duration, 1),
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def estimate_price_view(request):
    s = EstimatePriceSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=400)
    d = s.validated_data
    dist = _haversine(d['pickup_lat'], d['pickup_lng'], d['destination_lat'], d['destination_lng'])
    price, breakdown = _calc_price(dist)
    return Response({'estimated_price': price, 'breakdown': breakdown})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_ride(request):
    s = RequestRideSerializer(data=request.data)
    if not s.is_valid():
        return Response(s.errors, status=400)
    d = s.validated_data
    dist = _haversine(d['pickup_lat'], d['pickup_lng'], d['destination_lat'], d['destination_lng'])
    price, breakdown = _calc_price(dist)
    ride = Ride.objects.create(
        user=request.user,
        pickup_lat=d['pickup_lat'], pickup_lng=d['pickup_lng'], pickup_address=d['pickup_address'],
        destination_lat=d['destination_lat'], destination_lng=d['destination_lng'],
        destination_address=d['destination_address'],
        estimated_price=price, distance_km=dist, pricing_breakdown=breakdown,
        status='searching',
    )

    # Cache for fast driver-side lookup + publish to Redis Stream so drivers
    # are notified in real time. Postgres is the durable source of truth;
    # Redis failures here are logged but don't fail the request.
    cache_ride(ride)
    publish_ride_request(ride)

    return Response(RideSerializer(ride).data, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ride_detail(request, ride_id):
    try:
        ride = Ride.objects.get(id=ride_id, user=request.user)
    except Ride.DoesNotExist:
        return Response({'error': 'Ride not found.'}, status=404)
    return Response(RideSerializer(ride).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_ride(request, ride_id):
    try:
        ride = Ride.objects.get(id=ride_id, user=request.user)
    except Ride.DoesNotExist:
        return Response({'error': 'Ride not found.'}, status=404)
    if ride.status in ('completed', 'cancelled'):
        return Response({'error': 'Cannot cancel this ride.'}, status=400)
    ride.status = 'cancelled'
    ride.cancelled_at = timezone.now()
    ride.cancelled_by = 'user'
    ride.cancel_reason = request.data.get('reason', '')
    ride.save(update_fields=['status', 'cancelled_at', 'cancelled_by', 'cancel_reason'])
    invalidate_ride_cache(str(ride.id))
    return Response(RideSerializer(ride).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ride_history(request):
    rides = Ride.objects.filter(user=request.user).order_by('-requested_at')[:20]
    return Response(RideSerializer(rides, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def frequent_destinations(request):
    """Top destinations from the user's completed rides, ranked by trip count.

    Used by the booking screen's "Frequent places" section. Groups by
    destination_address (case-insensitive on the most recent variant) so a
    location visited 5 times bubbles to the top. Returns at most `limit`
    entries (default 5, max 10).
    """
    from django.db.models import Count, Max
    try:
        limit = min(int(request.query_params.get('limit', 5)), 10)
    except ValueError:
        limit = 5

    # Group by exact destination_address. For each group, pick the most-recent
    # row's lat/lng/address as the representative entry.
    grouped = (
        Ride.objects
        .filter(user=request.user, status='completed')
        .values('destination_address')
        .annotate(trip_count=Count('id'), last_used_at=Max('ride_completed_at'))
        .order_by('-trip_count', '-last_used_at')[:limit]
    )

    results = []
    for entry in grouped:
        # Pull lat/lng from the most-recent ride to that address
        latest = (
            Ride.objects
            .filter(
                user=request.user,
                status='completed',
                destination_address=entry['destination_address'],
            )
            .order_by('-ride_completed_at')
            .values('destination_lat', 'destination_lng', 'destination_address')
            .first()
        )
        if not latest:
            continue
        results.append({
            'lat': float(latest['destination_lat']),
            'lng': float(latest['destination_lng']),
            'display_name': latest['destination_address'],
            'trip_count': entry['trip_count'],
            'last_used_at': entry['last_used_at'].isoformat() if entry['last_used_at'] else None,
        })

    return Response(results)


@api_view(['GET'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def driver_pending_rides(request):
    """Return searching rides for the driver to browse."""
    rides = (
        Ride.objects.filter(status='searching')
        .select_related('user')
        .order_by('requested_at')[:10]
    )
    return Response(RideSerializer(rides, many=True).data)


@api_view(['POST'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def driver_accept_ride(request, ride_id):
    """Atomically claim a searching ride for this driver and generate an OTP."""
    driver = request.user
    now = timezone.now()
    otp = _generate_otp()
    with transaction.atomic():
        updated = Ride.objects.filter(id=ride_id, status='searching').select_for_update().update(
            driver=driver,
            status='driver_assigned',
            driver_assigned_at=now,
            otp_code=otp,
            otp_expires_at=now + timedelta(minutes=OTP_TTL_MINUTES),
        )
    if not updated:
        return Response({'error': 'Ride is no longer available.'}, status=409)
    ride = Ride.objects.select_related('user', 'driver', 'vehicle').get(id=ride_id)
    return Response(RideSerializer(ride).data)


@api_view(['POST'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def driver_verify_otp(request, ride_id):
    """Driver submits the OTP spoken by the passenger to unlock ride start."""
    submitted = str(request.data.get('otp', '')).strip()
    if not submitted or len(submitted) != 4:
        return Response({'error': 'OTP must be 4 digits.'}, status=400)

    driver = request.user
    try:
        ride = Ride.objects.get(id=ride_id, driver=driver)
    except Ride.DoesNotExist:
        return Response({'error': 'Ride not found.'}, status=404)

    if ride.status not in ('driver_assigned', 'driver_arriving'):
        return Response(
            {'error': f'Cannot verify OTP in status {ride.status!r}.'}, status=400
        )
    if not ride.otp_code:
        return Response({'error': 'No OTP on this ride.'}, status=400)
    if ride.otp_expires_at and ride.otp_expires_at < timezone.now():
        return Response({'error': 'OTP has expired.'}, status=400)
    if not secrets.compare_digest(submitted, ride.otp_code):
        return Response({'error': 'Invalid OTP.'}, status=400)

    ride.status = 'otp_verified'
    ride.otp_verified = True
    ride.otp_verified_at = timezone.now()
    ride.otp_code = ''  # clear the code once verified
    ride.save(update_fields=[
        'status', 'otp_verified', 'otp_verified_at', 'otp_code', 'updated_at',
    ])
    return Response(RideSerializer(ride).data)


@api_view(['GET'])
@authentication_classes([UniversalFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def get_ride_route(request, ride_id):
    """Return a GeoJSON LineString for the pickup → destination route.

    Accessible to the ride's passenger OR its assigned driver. Falls back to a
    straight line if the OSRM service is unreachable.
    """
    from apps.users.models import User, Driver
    try:
        ride = Ride.objects.get(id=ride_id)
    except Ride.DoesNotExist:
        return Response({'error': 'Ride not found.'}, status=404)

    user = request.user
    is_passenger = isinstance(user, User) and ride.user_id == user.id
    is_driver = isinstance(user, Driver) and ride.driver_id == user.id
    if not (is_passenger or is_driver):
        return Response({'error': 'Ride not found.'}, status=404)

    pickup = (float(ride.pickup_lng), float(ride.pickup_lat))
    dest = (float(ride.destination_lng), float(ride.destination_lat))

    osrm_url = settings.OSRM_URL.rstrip('/')
    url = (
        f'{osrm_url}/route/v1/driving/'
        f'{pickup[0]},{pickup[1]};{dest[0]},{dest[1]}'
        f'?geometries=geojson&overview=full'
    )

    try:
        resp = requests.get(url, timeout=4)
        resp.raise_for_status()
        data = resp.json()
        if data.get('code') == 'Ok' and data.get('routes'):
            route = data['routes'][0]
            return Response({
                'geometry': route['geometry'],
                'distance_m': route.get('distance'),
                'duration_s': route.get('duration'),
                'source': 'osrm',
            })
    except requests.RequestException:
        pass

    # Fallback: straight line between pickup and destination
    return Response({
        'geometry': {
            'type': 'LineString',
            'coordinates': [list(pickup), list(dest)],
        },
        'distance_m': None,
        'duration_s': None,
        'source': 'fallback',
    })


@api_view(['GET'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def driver_active_ride(request):
    """Get driver's current active ride (if any)."""
    driver = request.user
    ride = (
        Ride.objects.filter(
            driver=driver,
            status__in=['driver_assigned', 'driver_arriving', 'otp_verified', 'in_progress'],
        )
        .select_related('user', 'vehicle')
        .first()
    )
    if not ride:
        return Response({'error': 'No active ride.'}, status=404)
    return Response(RideSerializer(ride).data)


_DRIVER_STATUS_TRANSITIONS = {
    'driver_arriving': {'from': 'driver_assigned', 'timestamp_field': 'driver_arrived_at'},
    'in_progress':     {'from': 'otp_verified',    'timestamp_field': 'ride_started_at'},
    'completed':       {'from': 'in_progress',     'timestamp_field': 'ride_completed_at'},
}


@api_view(['POST'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def driver_update_ride_status(request, ride_id):
    """Advance the ride through its lifecycle stages."""
    new_status = request.data.get('status', '')
    transition = _DRIVER_STATUS_TRANSITIONS.get(new_status)
    if not transition:
        valid = list(_DRIVER_STATUS_TRANSITIONS.keys())
        return Response({'error': f'status must be one of {valid}.'}, status=400)

    driver = request.user
    try:
        ride = Ride.objects.get(id=ride_id, driver=driver)
    except Ride.DoesNotExist:
        return Response({'error': 'Ride not found.'}, status=404)

    if ride.status != transition['from']:
        return Response(
            {'error': f'Cannot transition from {ride.status!r} to {new_status!r}.'},
            status=400,
        )

    ride.status = new_status
    ts_field = transition['timestamp_field']
    setattr(ride, ts_field, timezone.now())
    ride.save(update_fields=['status', ts_field, 'updated_at'])
    return Response(RideSerializer(ride).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def driver_location(request, ride_id):
    from django.core.cache import cache
    try:
        ride = Ride.objects.get(id=ride_id, user=request.user)
    except Ride.DoesNotExist:
        return Response({'error': 'Ride not found.'}, status=404)
    if not ride.driver_id:
        return Response({'error': 'No driver assigned yet.'}, status=404)
    loc = cache.get(f'driver:{ride.driver_id}:location')
    if not loc:
        return Response({'error': 'Driver location unavailable.'}, status=404)
    return Response(loc)
