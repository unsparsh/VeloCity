import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from django.conf import settings
from rest_framework import authentication, exceptions
from apps.users.models import User, Driver


def _init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS)
        firebase_admin.initialize_app(cred)


class FirebaseAuthentication(authentication.BaseAuthentication):
    """DRF authentication class: validates Firebase ID token from Authorization header."""

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split('Bearer ')[1].strip()
        if not token:
            return None

        try:
            _init_firebase()
            decoded = firebase_auth.verify_id_token(token)
        except firebase_auth.ExpiredIdTokenError:
            raise exceptions.AuthenticationFailed('Token has expired.')
        except firebase_auth.InvalidIdTokenError:
            raise exceptions.AuthenticationFailed('Invalid Firebase token.')
        except Exception as e:
            raise exceptions.AuthenticationFailed(f'Authentication failed: {str(e)}')

        uid = decoded.get('uid')
        try:
            user = User.objects.get(firebase_uid=uid)
        except User.DoesNotExist:
            # Return decoded token so register endpoint can create the user
            return (None, {'firebase_uid': uid, 'decoded': decoded})

        if not user.is_active:
            raise exceptions.AuthenticationFailed('User account is disabled.')

        return (user, decoded)

    def authenticate_header(self, request):
        return 'Bearer realm="api"'


class DriverFirebaseAuthentication(FirebaseAuthentication):
    """Same as FirebaseAuthentication but looks up Driver instead of User."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, decoded = result
        uid = decoded.get('uid') if isinstance(decoded, dict) else decoded

        # If super() returned a User, swap for Driver
        if isinstance(user, User):
            try:
                driver = Driver.objects.get(firebase_uid=user.firebase_uid)
                return (driver, decoded)
            except Driver.DoesNotExist:
                raise exceptions.AuthenticationFailed('No driver profile for this account.')

        return result


class UniversalFirebaseAuthentication(FirebaseAuthentication):
    """Resolves the Firebase token to a User OR Driver — whichever exists.

    Use for endpoints that must be accessible from both passenger and driver apps
    (e.g. fetching a ride's route).
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, decoded = result
        if isinstance(user, User):
            return (user, decoded)

        uid = decoded.get('uid') if isinstance(decoded, dict) else None
        if uid:
            driver = Driver.objects.filter(firebase_uid=uid).first()
            if driver:
                return (driver, decoded)

        raise exceptions.AuthenticationFailed('No profile found for this token.')
