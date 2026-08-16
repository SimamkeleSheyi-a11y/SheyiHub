import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UserManager


class ThemePreference(models.TextChoices):
    LIGHT = "light", "Light"
    DARK = "dark", "Dark"
    SYSTEM = "system", "System"


class User(AbstractBaseUser, PermissionsMixin):
    """SheyiHub user: UUID PK, email-only login, verification-gated core features."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=100)
    avatar_url = models.URLField(blank=True, default="")
    bio = models.CharField(max_length=240, blank=True, default="")
    email_verified = models.BooleanField(default=False)
    theme_preference = models.CharField(
        max_length=10, choices=ThemePreference.choices, default=ThemePreference.SYSTEM
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email


class EmailVerificationCode(models.Model):
    """Stores only a hash of the current 6-digit email verification code."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="email_verification_code",
    )
    code_hash = models.CharField(max_length=128, blank=True, default="")
    expires_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return f"Email verification for {self.user.email}"
