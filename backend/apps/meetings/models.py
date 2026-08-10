import uuid

from django.conf import settings
from django.db import models

from .utils import generate_room_slug


class MeetingStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    LIVE = "live", "Live"
    ENDED = "ended", "Ended"
    CANCELLED = "cancelled", "Cancelled"


class Meeting(models.Model):
    """Matches Phase 2 §2's MEETING entity. `live`/`ended` transitions belong
    to the real-time phase (starting/ending an actual call) — Phase 4 only
    drives scheduled -> cancelled."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hosted_meetings"
    )
    title = models.CharField(max_length=200)
    scheduled_start = models.DateTimeField()
    scheduled_end = models.DateTimeField()
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=MeetingStatus.choices, default=MeetingStatus.SCHEDULED)
    room_slug = models.SlugField(max_length=32, unique=True, default=generate_room_slug, editable=False)
    waiting_room_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["scheduled_start"]
        indexes = [models.Index(fields=["host", "status"])]

    def __str__(self):
        return f"{self.title} ({self.room_slug})"


class ParticipantRole(models.TextChoices):
    HOST = "host", "Host"
    PARTICIPANT = "participant", "Participant"


class ParticipantStatus(models.TextChoices):
    WAITING = "waiting", "Waiting"
    ADMITTED = "admitted", "Admitted"
    DENIED = "denied", "Denied"


class MeetingParticipant(models.Model):
    """Matches Phase 2 §2's MEETING_PARTICIPANT entity. `status` here is
    about the waiting room, which becomes relevant once live calls exist;
    Phase 4 only needs the host<->meeting relationship to enforce
    permissions cleanly."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="meeting_participations"
    )
    role = models.CharField(
        max_length=11, choices=ParticipantRole.choices, default=ParticipantRole.PARTICIPANT
    )
    status = models.CharField(
        max_length=8, choices=ParticipantStatus.choices, default=ParticipantStatus.ADMITTED
    )
    joined_at = models.DateTimeField(null=True, blank=True)
    left_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("meeting", "user")]


class InviteStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"


class MeetingInvite(models.Model):
    """Matches Phase 2 §2's MEETING_INVITE entity."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="invites")
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="meeting_invites"
    )
    status = models.CharField(max_length=8, choices=InviteStatus.choices, default=InviteStatus.PENDING)

    class Meta:
        unique_together = [("meeting", "invited_user")]


class WhiteboardTool(models.TextChoices):
    DRAW = "draw", "Draw"
    ERASE = "erase", "Erase"


class MeetingWhiteboardStroke(models.Model):
    """A normalized vector stroke persisted for a meeting whiteboard.

    Points are stored as ``[{"x": 0..1, "y": 0..1}, ...]`` so the same
    board can be replayed at any canvas size on desktop or mobile.  Media
    remains peer-to-peer; only small drawing commands travel through Django.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="whiteboard_strokes")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meeting_whiteboard_strokes",
    )
    tool = models.CharField(max_length=5, choices=WhiteboardTool.choices, default=WhiteboardTool.DRAW)
    color = models.CharField(max_length=7, default="#111827")
    width = models.PositiveSmallIntegerField(default=4)
    points = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["meeting", "created_at"], name="meetings_me_meeting_0f637d_idx")]

    def __str__(self):
        return f"Whiteboard stroke {self.id} on {self.meeting_id}"
