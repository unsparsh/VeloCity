from django.conf import settings
from django.db.models import Sum
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import Driver
from apps.users.authentication.firebase import FirebaseAuthentication
from apps.rides.models import Ride
from apps.payments.models import Payment

from .serializers import AdminDriverSerializer, AdminPaymentSerializer, AdminRideSerializer


class IsAdminFirebaseUser(permissions.BasePermission):
    """Allows access only to Firebase UIDs listed in settings.ADMIN_FIREBASE_UIDS."""

    message = 'Admin access required.'

    def has_permission(self, request, view):
        firebase_uid = getattr(request.user, 'firebase_uid', None)
        if not firebase_uid:
            return False
        admin_uids = getattr(settings, 'ADMIN_FIREBASE_UIDS', [])
        return firebase_uid in admin_uids


class AdminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


_AUTH = [FirebaseAuthentication]
_PERMS = [permissions.IsAuthenticated, IsAdminFirebaseUser]

ACTIVE_STATUSES = ['driver_assigned', 'driver_arriving', 'otp_verified', 'in_progress']


class StatsView(APIView):
    authentication_classes = _AUTH
    permission_classes = _PERMS

    def get(self, request):
        today = timezone.now().date()

        total_rides = Ride.objects.count()
        active_rides = Ride.objects.filter(status__in=ACTIVE_STATUSES).count()
        rides_today = Ride.objects.filter(requested_at__date=today).count()
        total_revenue = (
            Payment.objects.filter(status='paid').aggregate(t=Sum('amount'))['t'] or 0
        )
        revenue_today = (
            Payment.objects.filter(status='paid', paid_at__date=today)
            .aggregate(t=Sum('amount'))['t'] or 0
        )
        active_drivers = Driver.objects.filter(is_online=True).count()

        return Response({
            'total_rides': total_rides,
            'active_rides': active_rides,
            'rides_today': rides_today,
            'total_revenue': str(total_revenue),
            'revenue_today': str(revenue_today),
            'active_drivers': active_drivers,
        })


class AdminRidesView(generics.ListAPIView):
    authentication_classes = _AUTH
    permission_classes = _PERMS
    serializer_class = AdminRideSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = Ride.objects.select_related('user', 'driver').order_by('-requested_at')
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs


class AdminDriversView(generics.ListAPIView):
    authentication_classes = _AUTH
    permission_classes = _PERMS
    serializer_class = AdminDriverSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        return Driver.objects.prefetch_related('vehicles').order_by('-created_at')


class AdminPaymentsView(generics.ListAPIView):
    authentication_classes = _AUTH
    permission_classes = _PERMS
    serializer_class = AdminPaymentSerializer
    pagination_class = AdminPagination

    def get_queryset(self):
        return Payment.objects.select_related('user', 'ride').order_by('-created_at')
