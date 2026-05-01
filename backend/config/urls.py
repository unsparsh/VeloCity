from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.users.urls')),
    path('api/v1/location/', include('apps.location.urls')),
    path('api/v1/rides/', include('apps.rides.urls')),
    path('api/v1/payments/', include('apps.payments.urls')),
    path('api/v1/admin/', include('apps.admin_api.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
