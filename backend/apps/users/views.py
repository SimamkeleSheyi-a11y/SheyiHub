from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import generics, permissions, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .cookies import clear_auth_cookies, set_auth_cookies, verify_csrf
from .serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendVerificationSerializer,
    UserProfileSerializer,
    VerifyEmailCodeSerializer,
    VerifyEmailSerializer,
)


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            UserProfileSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        email = (request.data.get("email") or "").lower().strip()
        password = request.data.get("password") or ""

        user = authenticate(request, username=email, password=password)
        if user is None or not user.is_active:
            raise AuthenticationFailed("Incorrect email or password.")

        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "access": str(refresh.access_token),
                "user": UserProfileSerializer(user).data,
            }
        )
        return set_auth_cookies(response, str(refresh))


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not raw_refresh:
            raise AuthenticationFailed("No refresh token found.")
        if not verify_csrf(request):
            raise AuthenticationFailed("CSRF check failed.")

        try:
            old_refresh = RefreshToken(raw_refresh)
        except TokenError:
            raise AuthenticationFailed("Refresh token is invalid or expired.") from None

        user_id = old_refresh["user_id"]
        old_refresh.blacklist()

        from .models import User

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed("Account no longer exists.") from None

        new_refresh = RefreshToken.for_user(user)
        response = Response({"access": str(new_refresh.access_token)})
        return set_auth_cookies(response, str(new_refresh))


class LogoutView(APIView):
    def post(self, request):
        raw_refresh = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_auth_cookies(response)


class VerifyEmailCodeView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = VerifyEmailCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "detail": "Email verified.",
                "email_verified": True,
                "email": user.email,
            }
        )


class VerifyEmailView(APIView):
    """Legacy link endpoint kept so old verification emails do not break."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        return Response({"detail": "Email verified."})


class ResendVerificationView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = ResendVerificationSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        return Response(
            {
                "detail": (
                    "If that account still needs verification, "
                    "a new code has been sent."
                ),
                **result,
            }
        )


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password-reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "If that account exists, a reset link has been sent."}
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "password-reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password has been reset."})


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user


class WsTicketView(APIView):
    throttle_scope = "ws-ticket"

    def post(self, request):
        import secrets

        from django.core.cache import cache

        ticket = secrets.token_urlsafe(24)
        cache.set(f"ws-ticket:{ticket}", str(request.user.id), timeout=30)
        return Response({"ticket": ticket})
