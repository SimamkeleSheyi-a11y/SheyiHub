import uuid

from django.conf import settings
from django.db import models


class NotificationKind(models.TextChoices):
    MESSAGE = "message", "Message"
    MEETING_INVITE = "meeting_invite", "Meeting invite"
    MEETING_RESPONSE = "meeting_response", "Meeting response"
    MEETING_STARTED = "meeting_started", "Meeting started"
    FILE_SHARED = "file_shared", "File shared"


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications_created",
    )
    kind = models.CharField(max_length=32, choices=NotificationKind.choices)
    title = models.CharField(max_length=160)
    body = models.CharField(max_length=400, blank=True, default="")
    target_url = models.CharField(max_length=300, blank=True, default="")
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"], name="notif_user_created_idx"),
            models.Index(fields=["user", "read_at"], name="notif_user_read_idx"),
        ]

    @property
    def is_read(self):
        return self.read_at is not None


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
        primary_key=True,
    )
    messages_enabled = models.BooleanField(default=True)
    meetings_enabled = models.BooleanField(default=True)
    files_enabled = models.BooleanField(default=True)
    browser_enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
