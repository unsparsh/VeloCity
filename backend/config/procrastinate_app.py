import procrastinate
from django.conf import settings

app = procrastinate.AiopgExtensionConfig(
    connector_config=procrastinate.ConnectorConfig(
        host=settings.DATABASES['default']['HOST'],
        port=int(settings.DATABASES['default']['PORT']),
        user=settings.DATABASES['default']['USER'],
        password=settings.DATABASES['default']['PASSWORD'],
        dbname=settings.DATABASES['default']['NAME'],
    )
).app
