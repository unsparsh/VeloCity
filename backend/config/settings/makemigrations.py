"""
Minimal settings for running makemigrations locally without Docker.
Uses SQLite (no Postgres needed) and stubs out redis/procrastinate/firebase.
Never import this in production.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = 'makemigrations-only-not-for-production'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    # Project apps
    'apps.users',
    'apps.rides',
    'apps.location',
    'apps.payments',
    'apps.notifications',
    'apps.pricing',
    'apps.analytics',
    'apps.admin_api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# SQLite — no Postgres or Docker needed
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db_local.sqlite3',
    }
}

# Stub out redis cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Stub out external service settings so imports don't fail
FIREBASE_CREDENTIALS = {}
LOCATIONIQ_API_KEY = ''
OSRM_URL = 'http://localhost:5000'
RAZORPAY_KEY_ID = ''
RAZORPAY_KEY_SECRET = ''
RAZORPAY_WEBHOOK_SECRET = ''
REDIS_URL = 'redis://localhost:6379/0'
LOCATION_STREAM_KEY = 'location:events'
LOCATION_STREAM_GROUP = 'location-consumers'
LOCATION_STREAM_CONSUMER = 'consumer-1'
LOCATION_STREAM_MAXLEN = '10000'
LOCATION_DB_FLUSH_INTERVAL_SEC = '30'
