import signal
import time

import redis
from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Consume driver location events from Redis Streams and update hot cache + DB.'

    def handle(self, *args, **options):
        r = redis.from_url(settings.REDIS_URL)
        stream = settings.LOCATION_STREAM_KEY
        group = settings.LOCATION_STREAM_GROUP
        consumer = settings.LOCATION_STREAM_CONSUMER
        flush_interval = int(settings.LOCATION_DB_FLUSH_INTERVAL_SEC)

        try:
            r.xgroup_create(stream, group, id='0', mkstream=True)
            self.stdout.write(f'[location-consumer] Created group {group!r}')
        except redis.exceptions.ResponseError as exc:
            if 'BUSYGROUP' not in str(exc):
                raise

        self.stdout.write(f'[location-consumer] Listening on stream {stream!r} ...')

        pending_db_updates: dict = {}
        last_flush = time.monotonic()
        running = True

        def _stop(sig, frame):
            nonlocal running
            running = False

        signal.signal(signal.SIGTERM, _stop)
        signal.signal(signal.SIGINT, _stop)

        while running:
            entries = r.xreadgroup(group, consumer, {stream: '>'}, count=100, block=1000)
            if entries:
                for _stream, messages in entries:
                    for msg_id, fields in messages:
                        driver_id = (fields.get(b'driver_id') or b'').decode()
                        lat_raw = (fields.get(b'lat') or b'').decode()
                        lng_raw = (fields.get(b'lng') or b'').decode()
                        heading_raw = (fields.get(b'heading') or b'0').decode()

                        if driver_id and lat_raw and lng_raw:
                            try:
                                loc = {
                                    'lat': float(lat_raw),
                                    'lng': float(lng_raw),
                                    'heading': float(heading_raw),
                                }
                            except ValueError:
                                r.xack(stream, group, msg_id)
                                continue

                            # Hot cache: 60-second TTL so stale drivers fall off
                            cache.set(f'driver:{driver_id}:location', loc, timeout=60)
                            pending_db_updates[driver_id] = loc

                        r.xack(stream, group, msg_id)

            now = time.monotonic()
            if pending_db_updates and (now - last_flush) >= flush_interval:
                self._flush_to_db(pending_db_updates)
                pending_db_updates = {}
                last_flush = now

        self.stdout.write('[location-consumer] Stopped gracefully.')

    def _flush_to_db(self, updates: dict) -> None:
        from django.utils import timezone
        from apps.users.models import Driver

        for driver_id, loc in updates.items():
            Driver.objects.filter(id=driver_id, is_online=True).update(
                current_lat=loc['lat'],
                current_lng=loc['lng'],
                location_updated_at=timezone.now(),
            )
        self.stdout.write(f'[location-consumer] Flushed {len(updates)} driver location(s) to DB.')
