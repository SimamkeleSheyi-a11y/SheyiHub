import uuid
from pathlib import Path


def shared_file_upload_to(instance, filename):
    """Store uploads under random names while preserving the display filename separately."""
    extension = Path(filename).suffix.lower()[:12]
    return f"shared_files/{uuid.uuid4().hex}{extension}"


from django.conf import settings
from django.db import models


class ConversationType(models.TextChoices):
    DM = "dm", "Direct message"
    GROUP = "group", "Group"
    MEETING = "meeting", "Meeting"  # populated once the video-calling phase wires meetings to chat


class Conversation(models.Model):
    """Matches Phase 2 §2's CONVERSATION entity — one model for meeting chat,
    DMs, and group chats (Phase 2 §11: DRY). `meeting` stays null until the
    phase that gives meetings a live chat panel."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=7, choices=ConversationType.choices)
    meeting = models.ForeignKey(
        "meetings.Meeting", null=True, blank=True, on_delete=models.CASCADE, related_name="conversation"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ConversationParticipant(models.Model):
    """Matches Phase 2 §2's CONVERSATION_PARTICIPANT entity. `last_read_message`
    powers read receipts without a row per message per reader."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    last_read_message = models.ForeignKey(
        "Message", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        unique_together = [("conversation", "user")]


class Message(models.Model):
    """Matches Phase 2 §2's MESSAGE entity."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages"
    )
    content = models.TextField(max_length=4000)
    client_message_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Client-generated idempotency key — a retried send with the same "
        "key returns the original message instead of creating a duplicate.",
    )
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sent_at"]
        indexes = [models.Index(fields=["conversation", "sent_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "sender", "client_message_id"],
                condition=~models.Q(client_message_id=""),
                name="unique_client_message_id_per_sender_conversation",
            )
        ]


class MessageReaction(models.Model):
    """Matches Phase 2 §2's MESSAGE_REACTION entity. Schema is in place now
    for consistency with the approved ERD; the reaction UI/consumer events
    are scoped to a later phase (Phase 5 is chat + presence only)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    emoji = models.CharField(max_length=8)

    class Meta:
        unique_together = [("message", "user", "emoji")]


class SharedFile(models.Model):
    """A file shared inside any SheyiHub conversation.

    Meeting chat, DMs and group chats all reuse Conversation, so one file
    model gives the product one permission/retention model too.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="shared_files")
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="shared_files"
    )
    file = models.FileField(upload_to=shared_file_upload_to)
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=127)
    size_bytes = models.PositiveBigIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
        indexes = [models.Index(fields=["conversation", "-uploaded_at"])]
