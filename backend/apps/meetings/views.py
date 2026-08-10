from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsEmailVerified
from apps.messaging.models import Conversation, ConversationParticipant, ConversationType
from apps.messaging.serializers import ConversationSerializer
from apps.notifications.models import NotificationKind
from apps.notifications.services import create_notification

from .models import InviteStatus, Meeting, MeetingInvite, MeetingStatus
from .permissions import IsMeetingHost, IsMeetingParticipantOrHost
from .serializers import (
    AddParticipantSerializer,
    MeetingDetailSerializer,
    MeetingListSerializer,
    MeetingWriteSerializer,
    ParticipantSerializer,
    RespondToInviteSerializer,
)


class MeetingViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Meeting.objects.filter(Q(host=user) | Q(participants__user=user) | Q(invites__invited_user=user))
            .select_related("host")
            .prefetch_related("invites__invited_user")
            .distinct()
        )

        scope = self.request.query_params.get("scope")
        now = timezone.now()
        if scope == "upcoming":
            qs = qs.filter(Q(status=MeetingStatus.LIVE) | Q(scheduled_start__gte=now)).exclude(
                status__in=[MeetingStatus.CANCELLED, MeetingStatus.ENDED]
            )
        elif scope in ("history", "past"):
            qs = qs.filter(Q(scheduled_end__lt=now) | Q(status=MeetingStatus.ENDED)).exclude(
                status=MeetingStatus.CANCELLED
            )
        elif scope == "cancelled":
            qs = qs.filter(status=MeetingStatus.CANCELLED)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return MeetingListSerializer
        if self.action == "retrieve":
            return MeetingDetailSerializer
        if self.action == "participants":
            return AddParticipantSerializer if self.request.method == "POST" else ParticipantSerializer
        if self.action == "respond":
            return RespondToInviteSerializer
        return MeetingWriteSerializer

    def get_permissions(self):
        base = [permissions.IsAuthenticated]
        if self.action == "create":
            base.append(IsEmailVerified)
        elif self.action in ("retrieve", "conversation", "whiteboard"):
            base.append(IsMeetingParticipantOrHost)
        elif self.action in ("partial_update", "update", "destroy", "participants", "remove_participant", "start", "end"):
            base.append(IsMeetingHost)
        return [permission() for permission in base]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting = serializer.save()
        return Response(
            MeetingDetailSerializer(meeting, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        meeting = serializer.save()
        return Response(MeetingDetailSerializer(meeting, context=self.get_serializer_context()).data)

    def destroy(self, request, *args, **kwargs):
        meeting = self.get_object()
        if meeting.status != MeetingStatus.CANCELLED:
            meeting.status = MeetingStatus.CANCELLED
            meeting.save(update_fields=["status"])
        return Response(status=status.HTTP_204_NO_CONTENT)


    def _notify_users(self, meeting, event_type):
        channel_layer = get_channel_layer()
        user_ids = {str(meeting.host_id)}
        user_ids.update(str(uid) for uid in meeting.invites.values_list("invited_user_id", flat=True))
        for user_id in user_ids:
            async_to_sync(channel_layer.group_send)(
                f"user_{user_id}",
                {"type": event_type, "meeting_id": str(meeting.id)},
            )

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        """Host starts a scheduled meeting. Idempotent while already live."""
        meeting = self.get_object()
        if meeting.status in (MeetingStatus.CANCELLED, MeetingStatus.ENDED):
            return Response(
                {"detail": "A cancelled or ended meeting cannot be started."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if meeting.status == MeetingStatus.SCHEDULED:
            meeting.status = MeetingStatus.LIVE
            meeting.actual_start = meeting.actual_start or timezone.now()
            meeting.save(update_fields=["status", "actual_start"])
            self._notify_users(meeting, "meeting.started")
            for user_id in meeting.invites.exclude(status=InviteStatus.DECLINED).values_list("invited_user_id", flat=True):
                create_notification(
                    user_id=user_id,
                    actor_id=meeting.host_id,
                    kind=NotificationKind.MEETING_STARTED,
                    title=f"{meeting.host.display_name} started a meeting",
                    body=meeting.title,
                    target_url=f"/meetings/{meeting.id}/room",
                )
        return Response(MeetingDetailSerializer(meeting, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        """Host ends the live meeting and closes every active participant row."""
        meeting = self.get_object()
        if meeting.status == MeetingStatus.CANCELLED:
            return Response(
                {"detail": "A cancelled meeting cannot be ended."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if meeting.status != MeetingStatus.ENDED:
            now = timezone.now()
            meeting.status = MeetingStatus.ENDED
            meeting.actual_end = meeting.actual_end or now
            meeting.save(update_fields=["status", "actual_end"])
            meeting.participants.filter(left_at__isnull=True).update(left_at=now)
            self._notify_users(meeting, "meeting.ended")
        return Response(MeetingDetailSerializer(meeting, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["get"])
    def whiteboard(self, request, pk=None):
        """Return the persisted collaborative whiteboard snapshot.

        The host and accepted invitees can reopen the board after the meeting
        ends. Pending/declined invitees cannot inspect collaboration content.
        Drawing itself is handled over the authenticated meeting WebSocket.
        """
        meeting = self.get_object()
        if meeting.host_id != request.user.id and not meeting.invites.filter(
            invited_user=request.user, status=InviteStatus.ACCEPTED
        ).exists():
            return Response(
                {"detail": "Accept the meeting invitation before opening the whiteboard."},
                status=status.HTTP_403_FORBIDDEN,
            )

        strokes = meeting.whiteboard_strokes.select_related("author").all()
        return Response(
            {
                "meeting_id": str(meeting.id),
                "strokes": [
                    {
                        "id": str(stroke.id),
                        "author_id": str(stroke.author_id) if stroke.author_id else None,
                        "author_name": stroke.author.display_name if stroke.author else "Former user",
                        "tool": stroke.tool,
                        "color": stroke.color,
                        "width": stroke.width,
                        "points": stroke.points,
                        "created_at": stroke.created_at.isoformat(),
                    }
                    for stroke in strokes
                ],
            }
        )

    @action(detail=True, methods=["get"])
    def conversation(self, request, pk=None):
        """Return the meeting's shared chat, creating/synchronising it lazily.

        Only the host and invitees who accepted may enter live meeting chat.
        The same Conversation/Message stack from Phase 5 is reused.
        """
        meeting = self.get_object()
        if meeting.host_id != request.user.id and not meeting.invites.filter(
            invited_user=request.user, status=InviteStatus.ACCEPTED
        ).exists():
            return Response(
                {"detail": "Accept the meeting invitation before opening meeting chat."},
                status=status.HTTP_403_FORBIDDEN,
            )

        allowed_user_ids = {meeting.host_id}
        allowed_user_ids.update(
            meeting.invites.filter(status=InviteStatus.ACCEPTED).values_list("invited_user_id", flat=True)
        )

        with transaction.atomic():
            conversation = (
                Conversation.objects.select_for_update()
                .filter(meeting=meeting, type=ConversationType.MEETING)
                .first()
            )
            if conversation is None:
                conversation = Conversation.objects.create(type=ConversationType.MEETING, meeting=meeting)

            conversation.participants.exclude(user_id__in=allowed_user_ids).delete()
            existing = set(conversation.participants.values_list("user_id", flat=True))
            ConversationParticipant.objects.bulk_create(
                [
                    ConversationParticipant(conversation=conversation, user_id=user_id)
                    for user_id in allowed_user_ids
                    if user_id not in existing
                ],
                ignore_conflicts=True,
            )

        conversation = Conversation.objects.prefetch_related(
            "participants__user", "participants__last_read_message", "messages__sender"
        ).get(pk=conversation.pk)
        return Response(ConversationSerializer(conversation, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"])
    def participants(self, request, pk=None):
        """List invitees/RSVPs or let the organiser add a registered user by email."""
        meeting = self.get_object()

        if request.method == "GET":
            invites = meeting.invites.select_related("invited_user").order_by(
                "invited_user__display_name", "invited_user__email"
            )
            return Response(ParticipantSerializer(invites, many=True).data)

        serializer = self.get_serializer(data=request.data, context={"meeting": meeting})
        serializer.is_valid(raise_exception=True)
        invite, created = serializer.save()
        return Response(
            ParticipantSerializer(invite).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["delete"], url_path=r"participants/(?P<invite_id>[^/.]+)")
    def remove_participant(self, request, pk=None, invite_id=None):
        """Organiser removes an invitee/participant record from the meeting."""
        meeting = self.get_object()
        try:
            invite = MeetingInvite.objects.get(pk=invite_id, meeting=meeting)
        except MeetingInvite.DoesNotExist:
            return Response({"detail": "No such participant on this meeting."}, status=status.HTTP_404_NOT_FOUND)
        # Future live-call phases may create MeetingParticipant rows. Remove one too if it exists.
        meeting.participants.filter(user=invite.invited_user).delete()
        invite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def respond(self, request, pk=None):
        """Allow the currently invited user to accept or decline their own invitation."""
        meeting = self.get_object()
        try:
            invite = meeting.invites.get(invited_user=request.user)
        except MeetingInvite.DoesNotExist:
            return Response(
                {"detail": "You weren't invited to this meeting."}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(data=request.data, context={"invite": invite})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ParticipantSerializer(invite).data)
