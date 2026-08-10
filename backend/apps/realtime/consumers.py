import re
import uuid

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from apps.meetings.models import (
    InviteStatus,
    Meeting,
    MeetingParticipant,
    MeetingStatus,
    MeetingWhiteboardStroke,
    WhiteboardTool,
    ParticipantRole,
    ParticipantStatus,
)
from apps.messaging.models import Conversation, ConversationParticipant, Message
from apps.messaging.serializers import MessageSerializer
from apps.messaging.services import get_or_create_message
from apps.notifications.models import NotificationKind
from apps.notifications.services import create_notification

from . import presence, typing_state


class UserConsumer(AsyncJsonWebsocketConsumer):
    """One authenticated socket per client.

    Phase 5 chat/presence, Phase 7 meeting signaling, and Phase 10
    notification delivery share this connection. Media never crosses Django: the server only validates and
    relays WebRTC SDP/ICE messages between admitted meeting participants.
    """

    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_id = str(user.id)
        self.group_name = f"user_{self.user_id}"
        self.meeting_ids: set[str] = set()
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        count = await database_sync_to_async(presence.add_connection)(self.user_id)
        if count == 1:
            await self._broadcast_presence()
        await self._send_presence_snapshot()

    async def disconnect(self, close_code):
        if not hasattr(self, "group_name"):
            return

        # Leave any live meeting groups before tearing down the personal group.
        for meeting_id in list(getattr(self, "meeting_ids", set())):
            await self._leave_meeting(meeting_id, broadcast=True)

        await self.channel_layer.group_discard(self.group_name, self.channel_name)

        typing_convs = await database_sync_to_async(typing_state.get_typing_conversations)(self.user_id)
        for conversation_id in typing_convs:
            participant_ids = await self._participant_ids(conversation_id)
            if not participant_ids:
                continue
            for uid in participant_ids:
                if uid == self.user_id:
                    continue
                await self.channel_layer.group_send(
                    f"user_{uid}",
                    {
                        "type": "typing",
                        "conversation_id": conversation_id,
                        "user_id": self.user_id,
                        "is_typing": False,
                    },
                )
            await database_sync_to_async(typing_state.clear_typing)(conversation_id, self.user_id)

        remaining = await database_sync_to_async(presence.remove_connection)(self.user_id)
        if remaining == 0:
            await database_sync_to_async(presence.mark_last_seen)(self.user_id)
            await self._broadcast_presence()

    async def receive_json(self, content, **kwargs):
        handler = {
            # Phase 5 realtime collaboration
            "chat-message": self._handle_chat_message,
            "typing": self._handle_typing,
            "message-read": self._handle_message_read,
            "set-status": self._handle_set_status,
            # Phase 7 live meeting room
            "meeting-join": self._handle_meeting_join,
            "meeting-leave": self._handle_meeting_leave,
            "meeting-admit": self._handle_meeting_admit,
            "meeting-deny": self._handle_meeting_deny,
            "webrtc-offer": self._handle_webrtc_offer,
            "webrtc-answer": self._handle_webrtc_answer,
            "ice-candidate": self._handle_ice_candidate,
            "media-state": self._handle_media_state,
            # Phase 9 collaborative whiteboard
            "whiteboard-stroke": self._handle_whiteboard_stroke,
            "whiteboard-clear": self._handle_whiteboard_clear,
            "whiteboard-undo": self._handle_whiteboard_undo,
        }.get(content.get("type"))
        if handler:
            await handler(content)

    # --- Phase 5 inbound client events ----------------------------------------

    async def _handle_chat_message(self, content):
        conversation_id = content.get("conversation_id")
        text = (content.get("content") or "").strip()
        client_message_id = content.get("client_message_id") or ""
        if not text:
            return
        result = await self._create_message(conversation_id, text, client_message_id)
        if result is None:
            await self._send_error("not_a_participant", "You're not part of this conversation.")
            return
        message_payload, participant_ids = result
        for uid in participant_ids:
            await self.channel_layer.group_send(f"user_{uid}", {"type": "chat.message", **message_payload})

    async def _handle_typing(self, content):
        conversation_id = content.get("conversation_id")
        is_typing = bool(content.get("is_typing"))
        participant_ids = await self._participant_ids(conversation_id)
        if participant_ids is None:
            return

        if is_typing:
            await database_sync_to_async(typing_state.mark_typing)(conversation_id, self.user_id)
            if await database_sync_to_async(typing_state.should_throttle)(conversation_id, self.user_id):
                return
        else:
            await database_sync_to_async(typing_state.clear_typing)(conversation_id, self.user_id)

        for uid in participant_ids:
            if uid == self.user_id:
                continue
            await self.channel_layer.group_send(
                f"user_{uid}",
                {
                    "type": "typing",
                    "conversation_id": conversation_id,
                    "user_id": self.user_id,
                    "is_typing": is_typing,
                },
            )

    async def _handle_message_read(self, content):
        conversation_id = content.get("conversation_id")
        message_id = content.get("last_read_message_id")
        result = await self._mark_read(conversation_id, message_id)
        if result == "not_a_member":
            await self._send_error("not_a_member", "You're not part of this conversation.")
            return
        if result == "invalid_message":
            await self._send_error("invalid_message", "That message doesn't belong to this conversation.")
            return
        for uid in result:
            if uid == self.user_id:
                continue
            await self.channel_layer.group_send(
                f"user_{uid}",
                {
                    "type": "message.read",
                    "conversation_id": conversation_id,
                    "user_id": self.user_id,
                    "last_read_message_id": message_id,
                },
            )

    async def _handle_set_status(self, content):
        status = content.get("status")
        if status not in presence.VALID_MANUAL_STATUSES:
            await self._send_error("invalid_status", "Status must be online, away, or offline.")
            return
        await database_sync_to_async(presence.set_manual_status)(self.user_id, status)
        await self._broadcast_presence()
        info = await database_sync_to_async(presence.get_effective_status)(self.user_id)
        await self.send_json({"type": "presence.update", "user_id": self.user_id, **info})

    # --- Phase 7 live meeting signaling ---------------------------------------

    async def _handle_meeting_join(self, content):
        meeting_id = str(content.get("meeting_id") or "")
        if not meeting_id:
            await self._send_error("invalid_meeting", "A meeting id is required.")
            return

        result = await self._join_meeting_db(meeting_id)
        if not result["ok"]:
            await self._send_error(result["code"], result["message"])
            return

        await self.channel_layer.group_add(f"meeting_{meeting_id}", self.channel_name)
        self.meeting_ids.add(meeting_id)

        # If the host's join transitioned scheduled -> live, tell every invitee
        # on their personal socket so an open lobby can update immediately.
        if result.get("started"):
            for uid in result.get("notify_user_ids", []):
                await self.channel_layer.group_send(
                    f"user_{uid}",
                    {"type": "meeting.started", "meeting_id": meeting_id},
                )

        await self.send_json(
            {
                "type": "meeting.joined",
                "meeting_id": meeting_id,
                "status": result["participant"]["status"],
                "participant": result["participant"],
                "participants": result["participants"],
                "is_host": result["is_host"],
            }
        )

        await self.channel_layer.group_send(
            f"meeting_{meeting_id}",
            {
                "type": "meeting.participant.updated",
                "meeting_id": meeting_id,
                "participant": result["participant"],
            },
        )

    async def _handle_meeting_leave(self, content):
        meeting_id = str(content.get("meeting_id") or "")
        if meeting_id:
            await self._leave_meeting(meeting_id, broadcast=True)

    async def _handle_meeting_admit(self, content):
        meeting_id = str(content.get("meeting_id") or "")
        target_user_id = str(content.get("user_id") or "")
        result = await self._set_waiting_status(meeting_id, target_user_id, ParticipantStatus.ADMITTED)
        if not result["ok"]:
            await self._send_error(result["code"], result["message"])
            return

        await self.channel_layer.group_send(
            f"user_{target_user_id}",
            {
                "type": "meeting.admitted",
                "meeting_id": meeting_id,
                "participant": result["participant"],
                "participants": result["participants"],
            },
        )
        await self.channel_layer.group_send(
            f"meeting_{meeting_id}",
            {
                "type": "meeting.participant.updated",
                "meeting_id": meeting_id,
                "participant": result["participant"],
            },
        )

    async def _handle_meeting_deny(self, content):
        meeting_id = str(content.get("meeting_id") or "")
        target_user_id = str(content.get("user_id") or "")
        result = await self._set_waiting_status(meeting_id, target_user_id, ParticipantStatus.DENIED)
        if not result["ok"]:
            await self._send_error(result["code"], result["message"])
            return

        await self.channel_layer.group_send(
            f"user_{target_user_id}",
            {"type": "meeting.denied", "meeting_id": meeting_id},
        )
        await self.channel_layer.group_send(
            f"meeting_{meeting_id}",
            {
                "type": "meeting.participant.updated",
                "meeting_id": meeting_id,
                "participant": result["participant"],
            },
        )

    async def _handle_webrtc_offer(self, content):
        await self._relay_signaling(content, outbound_type="webrtc.offer", payload_key="sdp")

    async def _handle_webrtc_answer(self, content):
        await self._relay_signaling(content, outbound_type="webrtc.answer", payload_key="sdp")

    async def _handle_ice_candidate(self, content):
        await self._relay_signaling(content, outbound_type="webrtc.ice_candidate", payload_key="candidate")

    async def _relay_signaling(self, content, *, outbound_type, payload_key):
        meeting_id = str(content.get("meeting_id") or "")
        target_user_id = str(content.get("target_user_id") or "")
        payload = content.get(payload_key)
        if not meeting_id or not target_user_id or payload is None:
            await self._send_error("invalid_signal", "Incomplete WebRTC signaling payload.")
            return

        allowed = await self._can_signal(meeting_id, target_user_id)
        if not allowed:
            await self._send_error("signal_not_allowed", "Both users must be admitted to this meeting.")
            return

        await self.channel_layer.group_send(
            f"user_{target_user_id}",
            {
                "type": outbound_type,
                "meeting_id": meeting_id,
                "from_user_id": self.user_id,
                payload_key: payload,
            },
        )

    async def _handle_media_state(self, content):
        meeting_id = str(content.get("meeting_id") or "")
        if not meeting_id or not await self._is_admitted(meeting_id, self.user_id):
            return
        await self.channel_layer.group_send(
            f"meeting_{meeting_id}",
            {
                "type": "meeting.media_state",
                "meeting_id": meeting_id,
                "user_id": self.user_id,
                "mic_enabled": bool(content.get("mic_enabled", True)),
                "camera_enabled": bool(content.get("camera_enabled", True)),
                "screen_sharing": bool(content.get("screen_sharing", False)),
            },
        )

    async def _handle_whiteboard_stroke(self, content):
        meeting_id = str(content.get("meeting_id") or "")
        stroke = content.get("stroke") or {}
        result = await self._save_whiteboard_stroke(meeting_id, stroke)
        if not result["ok"]:
            await self._send_error(result["code"], result["message"])
            return
        await self.channel_layer.group_send(
            f"meeting_{meeting_id}",
            {"type": "whiteboard.stroke", "meeting_id": meeting_id, "stroke": result["stroke"]},
        )

    async def _handle_whiteboard_clear(self, content):
        meeting_id = str(content.get("meeting_id") or "")
        result = await self._clear_whiteboard(meeting_id)
        if not result["ok"]:
            await self._send_error(result["code"], result["message"])
            return
        await self.channel_layer.group_send(
            f"meeting_{meeting_id}",
            {
                "type": "whiteboard.cleared",
                "meeting_id": meeting_id,
                "cleared_by": self.user_id,
                "cleared_at": timezone.now().isoformat(),
            },
        )

    async def _handle_whiteboard_undo(self, content):
        meeting_id = str(content.get("meeting_id") or "")
        result = await self._undo_whiteboard_stroke(meeting_id)
        if not result["ok"]:
            await self._send_error(result["code"], result["message"])
            return
        if result.get("stroke_id"):
            await self.channel_layer.group_send(
                f"meeting_{meeting_id}",
                {
                    "type": "whiteboard.removed",
                    "meeting_id": meeting_id,
                    "stroke_id": result["stroke_id"],
                },
            )

    async def _leave_meeting(self, meeting_id: str, *, broadcast: bool):
        if meeting_id not in getattr(self, "meeting_ids", set()):
            return
        participant = await self._mark_meeting_left(meeting_id)
        if broadcast and participant:
            await self.channel_layer.group_send(
                f"meeting_{meeting_id}",
                {
                    "type": "meeting.participant.left",
                    "meeting_id": meeting_id,
                    "user_id": self.user_id,
                },
            )
        await self.channel_layer.group_discard(f"meeting_{meeting_id}", self.channel_name)
        self.meeting_ids.discard(meeting_id)

    # --- outbound group-event handlers ----------------------------------------

    async def chat_message(self, event):
        await self.send_json(event)

    async def typing(self, event):
        await self.send_json(event)

    async def message_read(self, event):
        await self.send_json(event)

    async def file_shared(self, event):
        await self.send_json(event)

    async def notification_created(self, event):
        await self.send_json(event)

    async def presence_update(self, event):
        await self.send_json(event)

    async def meeting_started(self, event):
        await self.send_json(event)

    async def meeting_ended(self, event):
        await self.send_json(event)

    async def meeting_participant_updated(self, event):
        await self.send_json(event)

    async def meeting_participant_left(self, event):
        await self.send_json(event)

    async def meeting_admitted(self, event):
        await self.send_json(event)

    async def meeting_denied(self, event):
        await self.send_json(event)

    async def meeting_media_state(self, event):
        await self.send_json(event)

    async def whiteboard_stroke(self, event):
        await self.send_json(event)

    async def whiteboard_cleared(self, event):
        await self.send_json(event)

    async def whiteboard_removed(self, event):
        await self.send_json(event)

    async def webrtc_offer(self, event):
        await self.send_json(event)

    async def webrtc_answer(self, event):
        await self.send_json(event)

    async def webrtc_ice_candidate(self, event):
        await self.send_json(event)

    async def _send_error(self, code, message):
        await self.send_json({"type": "error", "code": code, "message": message})

    # --- DB access: Phase 9 whiteboard ----------------------------------------

    @database_sync_to_async
    def _save_whiteboard_stroke(self, meeting_id, payload):
        if not self._valid_uuid(meeting_id):
            return {"ok": False, "code": "invalid_meeting", "message": "A valid meeting id is required."}
        try:
            meeting = Meeting.objects.get(pk=meeting_id)
        except Meeting.DoesNotExist:
            return {"ok": False, "code": "meeting_not_found", "message": "Meeting not found."}
        if meeting.status != MeetingStatus.LIVE:
            return {"ok": False, "code": "whiteboard_closed", "message": "The whiteboard is only editable during a live meeting."}
        if not meeting.participants.filter(user_id=self.user_id, status=ParticipantStatus.ADMITTED, left_at__isnull=True).exists():
            return {"ok": False, "code": "whiteboard_not_allowed", "message": "You must be admitted to draw on this whiteboard."}

        stroke_id = str(payload.get("id") or "")
        if not self._valid_uuid(stroke_id):
            return {"ok": False, "code": "invalid_stroke", "message": "A valid stroke id is required."}
        tool = payload.get("tool")
        if tool not in (WhiteboardTool.DRAW, WhiteboardTool.ERASE):
            return {"ok": False, "code": "invalid_stroke", "message": "Unknown whiteboard tool."}
        color = str(payload.get("color") or "#111827")
        if tool == WhiteboardTool.DRAW and not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            return {"ok": False, "code": "invalid_stroke", "message": "Invalid pen colour."}
        if tool == WhiteboardTool.ERASE:
            color = "#000000"
        try:
            width = int(payload.get("width", 4))
        except (TypeError, ValueError):
            width = 0
        if width < 1 or width > 48:
            return {"ok": False, "code": "invalid_stroke", "message": "Stroke width must be between 1 and 48."}

        raw_points = payload.get("points")
        if not isinstance(raw_points, list) or not (1 <= len(raw_points) <= 1200):
            return {"ok": False, "code": "invalid_stroke", "message": "A stroke must contain between 1 and 1200 points."}
        points = []
        for point in raw_points:
            if not isinstance(point, dict):
                return {"ok": False, "code": "invalid_stroke", "message": "Invalid whiteboard point."}
            try:
                x = float(point.get("x"))
                y = float(point.get("y"))
            except (TypeError, ValueError):
                return {"ok": False, "code": "invalid_stroke", "message": "Invalid whiteboard point."}
            if not (0 <= x <= 1 and 0 <= y <= 1):
                return {"ok": False, "code": "invalid_stroke", "message": "Whiteboard points must stay on the board."}
            points.append({"x": round(x, 5), "y": round(y, 5)})

        defaults = {
            "meeting": meeting,
            "author_id": self.user_id,
            "tool": tool,
            "color": color,
            "width": width,
            "points": points,
        }
        stroke, created = MeetingWhiteboardStroke.objects.get_or_create(id=stroke_id, defaults=defaults)
        if not created and (str(stroke.meeting_id) != meeting_id or str(stroke.author_id) != self.user_id):
            return {"ok": False, "code": "invalid_stroke", "message": "That stroke id is already in use."}
        if created:
            stroke = MeetingWhiteboardStroke.objects.select_related("author").get(pk=stroke.pk)
        return {
            "ok": True,
            "stroke": {
                "id": str(stroke.id),
                "author_id": str(stroke.author_id) if stroke.author_id else None,
                "author_name": stroke.author.display_name if stroke.author else "Former user",
                "tool": stroke.tool,
                "color": stroke.color,
                "width": stroke.width,
                "points": stroke.points,
                "created_at": stroke.created_at.isoformat(),
            },
        }

    @database_sync_to_async
    def _clear_whiteboard(self, meeting_id):
        try:
            meeting = Meeting.objects.get(pk=meeting_id)
        except (Meeting.DoesNotExist, ValueError):
            return {"ok": False, "code": "meeting_not_found", "message": "Meeting not found."}
        if meeting.status != MeetingStatus.LIVE:
            return {"ok": False, "code": "whiteboard_closed", "message": "The whiteboard is only editable during a live meeting."}
        if str(meeting.host_id) != self.user_id:
            return {"ok": False, "code": "host_required", "message": "Only the host can clear the whiteboard."}
        if not meeting.participants.filter(user_id=self.user_id, status=ParticipantStatus.ADMITTED, left_at__isnull=True).exists():
            return {"ok": False, "code": "whiteboard_not_allowed", "message": "Join the meeting before clearing the whiteboard."}
        meeting.whiteboard_strokes.all().delete()
        return {"ok": True}

    @database_sync_to_async
    def _undo_whiteboard_stroke(self, meeting_id):
        try:
            meeting = Meeting.objects.get(pk=meeting_id)
        except (Meeting.DoesNotExist, ValueError):
            return {"ok": False, "code": "meeting_not_found", "message": "Meeting not found."}
        if meeting.status != MeetingStatus.LIVE:
            return {"ok": False, "code": "whiteboard_closed", "message": "The whiteboard is only editable during a live meeting."}
        if not meeting.participants.filter(user_id=self.user_id, status=ParticipantStatus.ADMITTED, left_at__isnull=True).exists():
            return {"ok": False, "code": "whiteboard_not_allowed", "message": "You must be admitted to edit this whiteboard."}
        stroke = meeting.whiteboard_strokes.filter(author_id=self.user_id).order_by("-created_at", "-id").first()
        if not stroke:
            return {"ok": True, "stroke_id": None}
        stroke_id = str(stroke.id)
        stroke.delete()
        return {"ok": True, "stroke_id": stroke_id}

    @staticmethod
    def _valid_uuid(value):
        try:
            uuid.UUID(str(value))
            return True
        except (ValueError, TypeError, AttributeError):
            return False

    # --- DB access: Phase 5 ----------------------------------------------------

    @database_sync_to_async
    def _create_message(self, conversation_id, text, client_message_id):
        try:
            conversation = Conversation.objects.get(pk=conversation_id)
        except Conversation.DoesNotExist:
            return None

        participant_ids = [str(pid) for pid in conversation.participants.values_list("user_id", flat=True)]
        if self.user_id not in participant_ids:
            return None

        message, created = get_or_create_message(
            conversation=conversation,
            sender_id=self.user_id,
            content=text,
            client_message_id=client_message_id,
        )
        ConversationParticipant.objects.filter(conversation=conversation, user_id=self.user_id).update(
            last_read_message=message
        )

        payload = MessageSerializer(message).data
        payload["id"] = str(payload["id"])
        payload["conversation"] = str(payload["conversation"])
        if created:
            for uid in participant_ids:
                if uid == self.user_id:
                    continue
                create_notification(
                    user_id=uid,
                    actor_id=self.user_id,
                    kind=NotificationKind.MESSAGE,
                    title=f"New message from {message.sender.display_name}",
                    body=message.content[:180],
                    target_url=f"/chats/{conversation.id}",
                )
        return payload, participant_ids

    @database_sync_to_async
    def _participant_ids(self, conversation_id):
        try:
            conversation = Conversation.objects.get(pk=conversation_id)
        except Conversation.DoesNotExist:
            return None
        ids = [str(pid) for pid in conversation.participants.values_list("user_id", flat=True)]
        return ids if self.user_id in ids else None

    @database_sync_to_async
    def _mark_read(self, conversation_id, message_id):
        try:
            participant = ConversationParticipant.objects.get(
                conversation_id=conversation_id, user_id=self.user_id
            )
        except ConversationParticipant.DoesNotExist:
            return "not_a_member"

        message_exists_here = Message.objects.filter(pk=message_id, conversation_id=conversation_id).exists()
        if not message_exists_here:
            return "invalid_message"

        participant.last_read_message_id = message_id
        participant.save(update_fields=["last_read_message"])

        ids = ConversationParticipant.objects.filter(conversation_id=conversation_id).values_list(
            "user_id", flat=True
        )
        return [str(i) for i in ids]

    @database_sync_to_async
    def _conversation_participant_ids_for_user(self):
        ids = set()
        conversations = Conversation.objects.filter(participants__user_id=self.user_id)
        for conv in conversations:
            ids.update(str(pid) for pid in conv.participants.values_list("user_id", flat=True))
        ids.discard(self.user_id)
        return list(ids)

    async def _broadcast_presence(self):
        info = await database_sync_to_async(presence.get_effective_status)(self.user_id)
        peer_ids = await self._conversation_participant_ids_for_user()
        for uid in peer_ids:
            await self.channel_layer.group_send(
                f"user_{uid}",
                {"type": "presence.update", "user_id": self.user_id, **info},
            )

    async def _send_presence_snapshot(self):
        peer_ids = await self._conversation_participant_ids_for_user()
        for uid in peer_ids:
            info = await database_sync_to_async(presence.get_effective_status)(uid)
            await self.send_json({"type": "presence.update", "user_id": uid, **info})

    # --- DB access: Phase 7 meetings ------------------------------------------

    @staticmethod
    def _participant_payload(participant: MeetingParticipant):
        return {
            "user_id": str(participant.user_id),
            "display_name": participant.user.display_name,
            "avatar_url": participant.user.avatar_url,
            "role": participant.role,
            "status": participant.status,
            "joined_at": participant.joined_at.isoformat() if participant.joined_at else None,
        }

    @classmethod
    def _meeting_snapshot(cls, meeting: Meeting):
        rows = (
            meeting.participants.select_related("user")
            .filter(left_at__isnull=True)
            .order_by("role", "user__display_name")
        )
        return [cls._participant_payload(row) for row in rows]

    @database_sync_to_async
    def _join_meeting_db(self, meeting_id):
        try:
            meeting = Meeting.objects.prefetch_related("invites").get(pk=meeting_id)
        except (Meeting.DoesNotExist, ValueError):
            return {"ok": False, "code": "meeting_not_found", "message": "Meeting not found."}

        if meeting.status in (MeetingStatus.CANCELLED, MeetingStatus.ENDED):
            return {"ok": False, "code": "meeting_closed", "message": "This meeting is no longer live."}

        is_host = str(meeting.host_id) == self.user_id
        started = False

        if is_host:
            if meeting.status == MeetingStatus.SCHEDULED:
                meeting.status = MeetingStatus.LIVE
                meeting.actual_start = meeting.actual_start or timezone.now()
                meeting.save(update_fields=["status", "actual_start"])
                started = True
            participant_status = ParticipantStatus.ADMITTED
            role = ParticipantRole.HOST
        else:
            invite = meeting.invites.filter(invited_user_id=self.user_id).first()
            if not invite:
                return {"ok": False, "code": "meeting_not_found", "message": "Meeting not found."}
            if invite.status != InviteStatus.ACCEPTED:
                return {
                    "ok": False,
                    "code": "invitation_required",
                    "message": "Accept the meeting invitation before joining.",
                }
            if meeting.status != MeetingStatus.LIVE:
                return {
                    "ok": False,
                    "code": "meeting_not_live",
                    "message": "The host has not started this meeting yet.",
                }
            previous = MeetingParticipant.objects.filter(meeting=meeting, user_id=self.user_id).first()
            if previous and previous.status == ParticipantStatus.DENIED:
                return {
                    "ok": False,
                    "code": "entry_denied",
                    "message": "The host did not admit you to this meeting.",
                }
            if previous and previous.status == ParticipantStatus.ADMITTED:
                participant_status = ParticipantStatus.ADMITTED
            else:
                participant_status = (
                    ParticipantStatus.WAITING if meeting.waiting_room_enabled else ParticipantStatus.ADMITTED
                )
            role = ParticipantRole.PARTICIPANT

        now = timezone.now()
        participant, _created = MeetingParticipant.objects.update_or_create(
            meeting=meeting,
            user_id=self.user_id,
            defaults={
                "role": role,
                "status": participant_status,
                "joined_at": now if participant_status == ParticipantStatus.ADMITTED else None,
                "left_at": None,
            },
        )
        participant = MeetingParticipant.objects.select_related("user").get(pk=participant.pk)

        return {
            "ok": True,
            "is_host": is_host,
            "started": started,
            "notify_user_ids": [str(uid) for uid in meeting.invites.values_list("invited_user_id", flat=True)],
            "participant": self._participant_payload(participant),
            "participants": self._meeting_snapshot(meeting),
        }

    @database_sync_to_async
    def _set_waiting_status(self, meeting_id, target_user_id, target_status):
        try:
            meeting = Meeting.objects.get(pk=meeting_id, host_id=self.user_id, status=MeetingStatus.LIVE)
            participant = MeetingParticipant.objects.select_related("user").get(
                meeting=meeting, user_id=target_user_id, status=ParticipantStatus.WAITING
            )
        except (Meeting.DoesNotExist, MeetingParticipant.DoesNotExist, ValueError):
            return {
                "ok": False,
                "code": "waiting_participant_not_found",
                "message": "That user is not waiting for this meeting.",
            }

        participant.status = target_status
        if target_status == ParticipantStatus.ADMITTED:
            participant.joined_at = timezone.now()
            participant.left_at = None
            fields = ["status", "joined_at", "left_at"]
        else:
            participant.left_at = timezone.now()
            fields = ["status", "left_at"]
        participant.save(update_fields=fields)

        return {
            "ok": True,
            "participant": self._participant_payload(participant),
            "participants": self._meeting_snapshot(meeting),
        }

    @database_sync_to_async
    def _mark_meeting_left(self, meeting_id):
        try:
            participant = MeetingParticipant.objects.select_related("user").get(
                meeting_id=meeting_id, user_id=self.user_id, left_at__isnull=True
            )
        except (MeetingParticipant.DoesNotExist, ValueError):
            return None
        participant.left_at = timezone.now()
        participant.save(update_fields=["left_at"])
        return self._participant_payload(participant)

    @database_sync_to_async
    def _is_admitted(self, meeting_id, user_id):
        return MeetingParticipant.objects.filter(
            meeting_id=meeting_id,
            user_id=user_id,
            status=ParticipantStatus.ADMITTED,
            left_at__isnull=True,
        ).exists()

    @database_sync_to_async
    def _can_signal(self, meeting_id, target_user_id):
        admitted = MeetingParticipant.objects.filter(
            meeting_id=meeting_id,
            status=ParticipantStatus.ADMITTED,
            left_at__isnull=True,
            user_id__in=[self.user_id, target_user_id],
        ).values_list("user_id", flat=True)
        return len({str(uid) for uid in admitted}) == 2
