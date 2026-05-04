import os
from pathlib import Path
import environ

env = environ.Env(DEBUG=(bool, False))

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = env('DJANGO_SECRET_KEY', default='dev-secret-key')

DEBUG = env('DJANGO_DEBUG', default=True)

ALLOWED_HOSTS = env('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'procrastinate.contrib.django',
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
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
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

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME', default='ev_rides'),
        'USER': env('DB_USER', default='postgres'),
        'PASSWORD': env('DB_PASSWORD', default='postgres'),
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT', default='5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# CORS
CORS_ALLOWED_ORIGINS = env('CORS_ALLOWED_ORIGINS', default='http://localhost:5173,http://localhost:5174,http://localhost:5175').split(',')

# Redis
REDIS_URL = env('REDIS_URL', default='redis://localhost:6379/0')
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'}
    }
}

# Procrastinate
PROCRASTINATE = {'app': 'config.procrastinate_app'}

# Firebase
FIREBASE_CREDENTIALS = {
    'type': env('FIREBASE_TYPE', default='service_account'),
    'project_id': env('FIREBASE_PROJECT_ID'),
    'private_key_id': env('FIREBASE_PRIVATE_KEY_ID'),
    'private_key': env('FIREBASE_PRIVATE_KEY', default='').replace('\n', '\n'),
    'client_email': env('FIREBASE_CLIENT_EMAIL'),
    'client_id': env('FIREBASE_CLIENT_ID'),
    'auth_uri': env('FIREBASE_AUTH_URI', default='https://accounts.google.com/o/oauth2/auth'),
    'token_uri': env('FIREBASE_TOKEN_URI', default='https://oauth2.googleapis.com/token'),
}

# Location Services
LOCATIONIQ_API_KEY = env('LOCATIONIQ_API_KEY', default='')
OSRM_URL = env('OSRM_URL', default='http://localhost:5000')

# Admin API — comma-separated Firebase UIDs that are allowed admin access
ADMIN_FIREBASE_UIDS = env.list('ADMIN_FIREBASE_UIDS', default=[])

# Razorpay (leave blank in dev to use mock mode)
RAZORPAY_KEY_ID = env('RAZORPAY_KEY_ID', default='')
RAZORPAY_KEY_SECRET = env('RAZORPAY_KEY_SECRET', default='')
RAZORPAY_WEBHOOK_SECRET = env('RAZORPAY_WEBHOOK_SECRET', default='')

# Redis Streams
LOCATION_STREAM_KEY = env('LOCATION_STREAM_KEY', default='location:events')
LOCATION_STREAM_GROUP = env('LOCATION_STREAM_GROUP', default='location-consumers')
LOCATION_STREAM_CONSUMER = env('LOCATION_STREAM_CONSUMER', default='consumer-1')
LOCATION_STREAM_MAXLEN = env('LOCATION_STREAM_MAXLEN', default='10000')
LOCATION_DB_FLUSH_INTERVAL_SEC = env('LOCATION_DB_FLUSH_INTERVAL_SEC', default='30')

# Ride request stream (drivers consume this for new pending rides)
RIDES_STREAM_KEY = env('RIDES_STREAM_KEY', default='rides:requests')
RIDES_STREAM_MAXLEN = env('RIDES_STREAM_MAXLEN', default='10000')
RIDE_CACHE_TTL_SEC = env('RIDE_CACHE_TTL_SEC', default='600')
