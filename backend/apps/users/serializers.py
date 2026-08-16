from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import serializers

from .models import EmailVerificationCode, User
from .tasks import (
    send_password_reset_email,
    send_verification_code_email,
)
from .tokens import email_verification_token, password_reset_token
from .verification import (
    issue_verification_code,
    max_verification_attempts,
    resend_cooldown_seconds,
)


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
        code, _ = issue_verification_code(user, force=True)
        if code:
            send_verification_code_email.delay(str(user.pk), code)
        return user


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


class VerifyEmailCodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(
        regex=r"^\d{6}$",
        error_messages={"invalid": "Enter the 6-digit code from your email."},
    )

    default_error = "That verification code is invalid or has expired."

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        try:
            user = User.objects.get(email=attrs["email"])
        except User.DoesNotExist:
            raise serializers.ValidationError({"code": self.default_error}) from None

        # Idempotent success is helpful if the user double-submits after verification.
        if user.email_verified:
            attrs["user"] = user
            attrs["already_verified"] = True
            return attrs

        try:
            record = user.email_verification_code
        except EmailVerificationCode.DoesNotExist:
            raise serializers.ValidationError({"code": self.default_error}) from None

        if (
            not record.code_hash
            or record.expires_at is None
            or record.expires_at <= timezone.now()
            or record.attempts >= max_verification_attempts()
        ):
            raise serializers.ValidationError({"code": self.default_error})

        if not check_password(attrs["code"], record.code_hash):
            record.attempts += 1
            record.save(update_fields=["attempts"])
            raise serializers.ValidationError({"code": self.default_error})

        attrs["user"] = user
        attrs["verification_record"] = record
        attrs["already_verified"] = False
        return attrs

    def save(self):
        user = self.validated_data["user"]

        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=["email_verified"])

        EmailVerificationCode.objects.filter(user=user).delete()
        return user


class VerifyEmailSerializer(serializers.Serializer):
    """Legacy verification-link serializer kept for already-issued links."""

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
            raise serializers.ValidationError(
                "This verification link is invalid or has expired."
            )

        attrs["user"] = user
        return attrs


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        request = self.context.get("request")
        request_user = getattr(request, "user", None)

        if request_user is not None and request_user.is_authenticated:
            attrs["target_email"] = request_user.email
        elif attrs.get("email"):
            attrs["target_email"] = attrs["email"]
        else:
            raise serializers.ValidationError({"email": "Enter your email address."})

        return attrs

    def save(self):
        email = self.validated_data["target_email"]

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Do not reveal whether an account exists.
            return {"cooldown_seconds": resend_cooldown_seconds()}

        if user.email_verified:
            return {"cooldown_seconds": resend_cooldown_seconds()}

        code, remaining = issue_verification_code(user, force=False)
        if code:
            send_verification_code_email.delay(str(user.pk), code)

        return {"cooldown_seconds": remaining}


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
            raise serializers.ValidationError(
                "This reset link is invalid or has expired."
            )

        attrs["user"] = user
        return attrs

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user
