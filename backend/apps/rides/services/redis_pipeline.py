"""Redis caching + stream publishing for ride lifecycle events.

Flow when a passenger requests a ride:
    1. Postgres row is created (durable record).
    2. Compact ride payload is cached at `ride:{id}` for fast driver lookup.
    3. Event is XADD'd to `rides:requests` stream so any consumer
       (driver app pollers, future websocket fan-out, FCM dispatcher)
       can react in real time without scanning Postgres.

Failures here MUST NOT block the HTTP response — Postgres has the
authoritative copy. The view treats Redis as best-effort.
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import TYPE_CHECKING, Any

import redis as redis_lib
from django.conf import settings
from django.core.cache import cache

if TYPE_CHECKING:
    from apps.rides.models import Ride

logger = logging.getLogger(__name__)


def _redis_client() -> redis_lib.Redis:
    return redis_lib.from_url(settings.REDIS_URL)


def _serialize(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    return value


def ride_to_payload(ride: "Ride") -> dict[str, Any]:
    """Compact dict suitable for Redis caching and stream events."""
    return {
        "ride_id": str(ride.id),
        "user_id": str(ride.user_id),
        "status": ride.status,
        "pickup_lat": _serialize(ride.pickup_lat),
        "pickup_lng": _serialize(ride.pickup_lng),
        "pickup_address": ride.pickup_address,
        "destination_lat": _serialize(ride.destination_lat),
        "destination_lng": _serialize(ride.destination_lng),
        "destination_address": ride.destination_address,
        "estimated_price": _serialize(ride.estimated_price),
        "distance_km": _serialize(ride.distance_km),
        "requested_at": ride.requested_at.isoformat() if ride.requested_at else None,
    }


def cache_ride(ride: "Ride") -> None:
    """Cache an active ride for fast driver-side lookup.

    Key: `ride:{id}`. TTL controlled by RIDE_CACHE_TTL_SEC.
    """
    payload = ride_to_payload(ride)
    ttl = int(settings.RIDE_CACHE_TTL_SEC)
    try:
        cache.set(f"ride:{ride.id}", payload, timeout=ttl)
    except Exception:
        logger.exception("Failed to cache ride %s", ride.id)


def publish_ride_request(ride: "Ride") -> None:
    """Append a ride-request event to the `rides:requests` Redis Stream.

    Drivers (or a fan-out worker) consume from this stream to be
    notified of new pending rides without polling Postgres.

    Stream fields are flat strings (Redis Streams requirement); the
    full payload is also serialised as JSON in the `payload` field.
    """
    payload = ride_to_payload(ride)
    fields = {
        "event": "ride.requested",
        "ride_id": payload["ride_id"],
        "user_id": payload["user_id"],
        "pickup_lat": str(payload["pickup_lat"]),
        "pickup_lng": str(payload["pickup_lng"]),
        "destination_lat": str(payload["destination_lat"]),
        "destination_lng": str(payload["destination_lng"]),
        "payload": json.dumps(payload, default=str),
    }
    try:
        client = _redis_client()
        client.xadd(
            settings.RIDES_STREAM_KEY,
            fields,
            maxlen=int(settings.RIDES_STREAM_MAXLEN),
            approximate=True,
        )
    except Exception:
        logger.exception("Failed to publish ride %s to stream", ride.id)


def invalidate_ride_cache(ride_id: str) -> None:
    """Remove the cached ride payload (call on cancel/complete)."""
    try:
        cache.delete(f"ride:{ride_id}")
    except Exception:
        logger.exception("Failed to invalidate ride cache %s", ride_id)
