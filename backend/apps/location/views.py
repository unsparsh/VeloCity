import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from apps.users.authentication.firebase import DriverFirebaseAuthentication


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_locations(request):
    """Proxy LocationIQ autocomplete — avoids exposing API key to client."""
    query = request.query_params.get('q', '').strip()
    if not query or len(query) < 2:
        return Response([])

    cache_key = f'locationiq:{query.lower()}'
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    api_key = settings.LOCATIONIQ_API_KEY
    if not api_key:
        return Response({'error': 'Location service not configured.'}, status=503)

    try:
        resp = requests.get(
            'https://api.locationiq.com/v1/autocomplete',
            params={'key': api_key, 'q': query, 'limit': 5, 'countrycodes': 'in'},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        cache.set(cache_key, data, timeout=300)
        return Response(data)
    except requests.RequestException as e:
        return Response({'error': str(e)}, status=503)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def reverse_geocode(request):
    """Reverse geocode lat/lng to an address via LocationIQ."""
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')
    if not lat or not lng:
        return Response({'error': 'lat and lng are required.'}, status=400)

    cache_key = f'revgeo:{lat},{lng}'
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    api_key = settings.LOCATIONIQ_API_KEY
    if not api_key:
        return Response({'error': 'Location service not configured.'}, status=503)

    try:
        resp = requests.get(
            'https://us1.locationiq.com/v1/reverse',
            params={'key': api_key, 'lat': lat, 'lon': lng, 'format': 'json'},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        cache.set(cache_key, data, timeout=600)
        return Response(data)
    except requests.RequestException as e:
        return Response({'error': str(e)}, status=503)


@api_view(['POST'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def update_driver_location(request):
    """Driver publishes location → Redis Stream."""
    import redis as redis_lib
    r = redis_lib.from_url(settings.REDIS_URL)

    driver_id = str(request.user.id)
    lat = request.data.get('lat')
    lng = request.data.get('lng')
    heading = request.data.get('heading', 0)

    if not lat or not lng:
        return Response({'error': 'lat and lng required.'}, status=400)

    r.xadd(
        settings.LOCATION_STREAM_KEY,
        {'driver_id': driver_id, 'lat': lat, 'lng': lng, 'heading': heading},
        maxlen=int(settings.LOCATION_STREAM_MAXLEN),
        approximate=True,
    )
    return Response({'status': 'ok'})


@api_view(['POST'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def go_online(request):
    """Mark driver as online and available for rides."""
    from apps.users.models import Driver
    driver = request.user
    if not isinstance(driver, Driver):
        return Response({'error': 'Driver profile required.'}, status=403)
    driver.is_online = True
    driver.save(update_fields=['is_online', 'updated_at'])
    return Response({'status': 'online'})


@api_view(['POST'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def go_offline(request):
    """Mark driver as offline."""
    from apps.users.models import Driver
    driver = request.user
    if not isinstance(driver, Driver):
        return Response({'error': 'Driver profile required.'}, status=403)
    driver.is_online = False
    driver.save(update_fields=['is_online', 'updated_at'])
    return Response({'status': 'offline'})
