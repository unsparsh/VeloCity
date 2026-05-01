from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from apps.users.authentication.firebase import FirebaseAuthentication, DriverFirebaseAuthentication
from .models import User, Driver
from .serializers import UserSerializer, UserRegisterSerializer, DriverSerializer


@api_view(['POST'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([AllowAny])
def register(request):
    """Create a user profile after Firebase sign-in."""
    token_data = request.auth
    if not token_data:
        return Response({'error': 'No auth token provided.'}, status=status.HTTP_401_UNAUTHORIZED)

    firebase_uid = token_data.get('uid') if isinstance(token_data, dict) else None
    if not firebase_uid:
        return Response({'error': 'Could not extract Firebase UID.'}, status=status.HTTP_400_BAD_REQUEST)

    # If user already exists, return existing profile
    existing = User.objects.filter(firebase_uid=firebase_uid).first()
    if existing:
        return Response(UserSerializer(existing).data, status=status.HTTP_200_OK)

    data = {**request.data, 'firebase_uid': firebase_uid}
    serializer = UserRegisterSerializer(data=data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.save()
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def me(request):
    """Return the authenticated user's profile."""
    return Response(UserSerializer(request.user).data)


@api_view(['PATCH'])
@authentication_classes([FirebaseAuthentication])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """Update the authenticated user's profile."""
    allowed = {k: v for k, v in request.data.items() if k in ('full_name', 'profile_picture_url')}
    serializer = UserSerializer(request.user, data=allowed, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    serializer.save()
    return Response(serializer.data)


# ── Driver auth ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([IsAuthenticated])
def driver_me(request):
    """Return the authenticated driver's profile."""
    if not isinstance(request.user, Driver):
        return Response({'error': 'Driver profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(DriverSerializer(request.user).data)


@api_view(['POST'])
@authentication_classes([DriverFirebaseAuthentication])
@permission_classes([AllowAny])
def register_driver(request):
    """
    Create a driver profile after Firebase sign-in.
    Drivers are pre-verified by admin; this just links their Firebase UID.
    """
    token_data = request.auth
    if not token_data:
        return Response({'error': 'No auth token provided.'}, status=status.HTTP_401_UNAUTHORIZED)

    firebase_uid = token_data.get('uid') if isinstance(token_data, dict) else None
    if not firebase_uid:
        return Response({'error': 'Could not extract Firebase UID.'}, status=status.HTTP_400_BAD_REQUEST)

    existing = Driver.objects.filter(firebase_uid=firebase_uid).first()
    if existing:
        return Response(DriverSerializer(existing).data, status=status.HTTP_200_OK)

    required_fields = ('full_name', 'phone', 'license_number')
    for field in required_fields:
        if not request.data.get(field):
            return Response({'error': f'{field} is required.'}, status=status.HTTP_400_BAD_REQUEST)

    driver = Driver.objects.create(
        firebase_uid=firebase_uid,
        full_name=request.data['full_name'],
        phone=request.data['phone'],
        email=request.data.get('email', ''),
        license_number=request.data['license_number'],
    )
    return Response(DriverSerializer(driver).data, status=status.HTTP_201_CREATED)
