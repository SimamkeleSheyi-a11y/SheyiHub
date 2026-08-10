import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from .managers import UserManager


class ThemePreference(models.TextChoices):
    LIGHT = "light", "Light"
    DARK = "dark", "Dark"
    SYSTEM = "system", "System"


class User(AbstractBaseUser, PermissionsMixin):
    """Matches Phase 2 §2's USER entity: UUID PK, email-only login, email
    verification gates access to core features (Phase 1 FR1.4)."""

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
