from django.contrib.auth.password_validation import validate_password
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import serializers

from .models import User
from .tasks import send_password_reset_email, send_verification_email
from .tokens import email_verification_token, password_reset_token


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "email", "password", "display_name"]
        read_only_fields = ["id"]

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        _queue_verification_email(user)
        return user


def _queue_verification_email(user: User):
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)
    send_verification_email.delay(str(user.pk), uidb64, token)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "display_name",
            "avatar_url",
            "bio",
            "email_verified",
            "theme_preference",
            "created_at",
        ]
        read_only_fields = ["id", "email", "email_verified", "created_at"]


class VerifyEmailSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    def validate(self, attrs):
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError("This verification link is invalid.") from None

        if not email_verification_token.check_token(user, attrs["token"]):
            raise serializers.ValidationError("This verification link is invalid or has expired.")

        attrs["user"] = user
        return attrs


class ResendVerificationSerializer(serializers.Serializer):
    def save(self):
        user = self.context["request"].user
        if not user.email_verified:
            _queue_verification_email(user)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self):
        email = self.validated_data["email"].lower().strip()
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Deliberately don't reveal whether the email exists.
            return
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = password_reset_token.make_token(user)
        send_password_reset_email.delay(str(user.pk), uidb64, token)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])

    def validate(self, attrs):
        from django.utils.encoding import force_str
        from django.utils.http import urlsafe_base64_decode

        try:
            user_id = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError("This reset link is invalid.") from None

        if not password_reset_token.check_token(user, attrs["token"]):
            raise serializers.ValidationError("This reset link is invalid or has expired.")

        attrs["user"] = user
        return attrs

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
