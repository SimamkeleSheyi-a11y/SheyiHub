import pytest
from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.core.cache import cache

from apps.messaging.models import Conversation, ConversationParticipant, Message
from apps.realtime.middleware import TicketAuthMiddlewareStack
from apps.realtime.routing import websocket_urlpatterns
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

application = TicketAuthMiddlewareStack(URLRouter(websocket_urlpatterns))


def issue_ticket(user) -> str:
    ticket = f"test-ticket-{user.id}"
    cache.set(f"ws-ticket:{ticket}", str(user.id), timeout=30)
    return ticket


async def connect_as(user):
    ticket = issue_ticket(user)
    communicator = WebsocketCommunicator(application, f"/ws/connect/?ticket={ticket}")
    connected, _ = await communicator.connect()
    assert connected
    return communicator


async def receive_ignoring_presence(comm, max_messages=10):
    """Connecting sends presence snapshots/broadcasts whose exact count and
    timing isn't deterministic once two consumers connect concurrently
    (accept() returns before the rest of connect() has necessarily finished
    running, so two connects can genuinely interleave) — that's harmless,
    idempotent noise on a real frontend. Tests should assert on the message
    that actually matters, not on exactly how many presence pings preceded it."""
    for _ in range(max_messages):
        msg = await comm.receive_json_from()
        if msg.get("type") != "presence.update":
            return msg
    raise AssertionError("Only presence.update messages arrived — expected something else")


async def receive_until_type(comm, expected_type, max_messages=20):
    """Wait for a specific WebSocket event type while tolerating unrelated
    realtime events that may legitimately interleave on the same user socket.

    Phase 10 adds ``notification.created`` events to the same connection used
    for chat, presence, meetings, files, and whiteboard events. Event ordering
    between independent group sends must not be treated as a protocol contract.
    """
    seen_types = []
    for _ in range(max_messages):
        msg = await comm.receive_json_from()
        seen_types.append(msg.get("type"))
        if msg.get("type") == expected_type:
            return msg
    raise AssertionError(
        f"No {expected_type!r} event arrived; saw event types: {seen_types}"
    )


async def test_connection_is_rejected_without_a_valid_ticket():
    communicator = WebsocketCommunicator(application, "/ws/connect/?ticket=bogus")
    connected, _ = await communicator.connect()
    assert connected is False
    await communicator.disconnect()


async def test_connecting_broadcasts_online_presence_to_conversation_peers():
    me = await sync_create_user()
    other = await sync_create_user()
    await sync_create_dm(me, other)

    other_comm = await connect_as(other)
    me_comm = await connect_as(me)

    event = await receive_ignoring_presence_for_user(other_comm, str(me.id), expected_status="online")
    assert event == {"type": "presence.update", "user_id": str(me.id), "status": "online", "last_seen": None}

    await me_comm.disconnect()
    await other_comm.disconnect()


async def receive_ignoring_presence_for_user(comm, target_user_id, expected_status=None, max_messages=10):
    """Like receive_ignoring_presence, but specifically waits for a presence
    event *about* target_user_id. If expected_status is given, also skips
    past any earlier snapshot for that same user with a different status
    (e.g. a stale "offline" snapshot generated before they'd connected yet) —
    otherwise a stale match could be returned while the real update sits
    unconsumed in the queue.
    """
    for _ in range(max_messages):
        msg = await comm.receive_json_from()
        if msg.get("type") == "presence.update" and msg.get("user_id") == target_user_id:
            if expected_status is None or msg.get("status") == expected_status:
                return msg
    raise AssertionError(f"No matching presence.update about {target_user_id} arrived")


async def test_chat_message_is_persisted_and_delivered_to_the_other_participant():
    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    await me_comm.send_json_to(
        {"type": "chat-message", "conversation_id": str(conversation.id), "content": "hi"}
    )

    delivered = await receive_until_type(other_comm, "chat.message")
    assert delivered["type"] == "chat.message"
    assert delivered["content"] == "hi"
    assert delivered["sender"]["id"] == str(me.id)

    echoed = await receive_ignoring_presence(me_comm)
    assert echoed["content"] == "hi"

    await me_comm.disconnect()
    await other_comm.disconnect()


async def test_chat_message_creates_realtime_notification_for_recipient():
    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    await me_comm.send_json_to(
        {"type": "chat-message", "conversation_id": str(conversation.id), "content": "notify me"}
    )

    event = await receive_until_type(other_comm, "notification.created")
    notification = event["notification"]
    assert notification["kind"] == "message"
    assert notification["target_url"] == f"/chats/{conversation.id}"
    assert "notify me" in notification["body"]

    await me_comm.disconnect()
    await other_comm.disconnect()


async def test_resending_the_same_client_message_id_does_not_duplicate():
    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    payload = {
        "type": "chat-message",
        "conversation_id": str(conversation.id),
        "content": "hi",
        "client_message_id": "idempotent-key-1",
    }
    await me_comm.send_json_to(payload)
    first = await receive_until_type(other_comm, "chat.message")
    await receive_until_type(me_comm, "chat.message")  # echo to sender

    # Simulate a retry after a dropped ack, same idempotency key.
    await me_comm.send_json_to(payload)
    second = await receive_until_type(other_comm, "chat.message")
    await receive_until_type(me_comm, "chat.message")

    assert first["id"] == second["id"]
    assert await sync_count_messages(conversation) == 1

    await me_comm.disconnect()
    await other_comm.disconnect()


async def test_typing_indicator_goes_to_the_other_participant_not_self():
    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    await me_comm.send_json_to({"type": "typing", "conversation_id": str(conversation.id), "is_typing": True})

    event = await receive_ignoring_presence(other_comm)
    assert event == {
        "type": "typing",
        "conversation_id": str(conversation.id),
        "user_id": str(me.id),
        "is_typing": True,
    }

    await me_comm.send_json_to(
        {"type": "typing", "conversation_id": str(conversation.id), "is_typing": False}
    )
    stopped = await receive_ignoring_presence(other_comm)
    assert stopped["is_typing"] is False

    await me_comm.disconnect()
    await other_comm.disconnect()


async def test_read_receipt_updates_participant_and_notifies_the_other_side():
    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)
    message = await sync_create_message(conversation, other, "hello")

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    await me_comm.send_json_to(
        {
            "type": "message-read",
            "conversation_id": str(conversation.id),
            "last_read_message_id": str(message.id),
        }
    )

    event = await receive_ignoring_presence(other_comm)
    assert event["type"] == "message.read"
    assert event["last_read_message_id"] == str(message.id)

    await me_comm.disconnect()
    await other_comm.disconnect()


async def test_read_receipt_rejects_a_message_id_from_a_different_conversation():
    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)
    other_conversation = await sync_create_dm(other, await sync_create_user())
    foreign_message = await sync_create_message(other_conversation, other, "not yours")

    me_comm = await connect_as(me)
    await connect_as(other)  # keep other connected, unused directly here

    await me_comm.send_json_to(
        {
            "type": "message-read",
            "conversation_id": str(conversation.id),
            "last_read_message_id": str(foreign_message.id),
        }
    )

    event = await receive_ignoring_presence(me_comm)
    assert event == {
        "type": "error",
        "code": "invalid_message",
        "message": "That message doesn't belong to this conversation.",
    }
    assert await sync_get_last_read(conversation, me) is None

    await me_comm.disconnect()


async def test_read_receipt_rejects_a_non_member():
    conversation = await sync_create_dm(await sync_create_user(), await sync_create_user())
    stranger = await sync_create_user()
    stranger_comm = await connect_as(stranger)

    await stranger_comm.send_json_to(
        {
            "type": "message-read",
            "conversation_id": str(conversation.id),
            "last_read_message_id": "not-a-real-id",
        }
    )

    event = await receive_ignoring_presence(stranger_comm)
    assert event["type"] == "error"
    assert event["code"] == "not_a_member"

    await stranger_comm.disconnect()


async def test_manual_status_change_is_sent_to_backend_and_broadcast_to_peers():
    me = await sync_create_user()
    other = await sync_create_user()
    await sync_create_dm(me, other)

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    await me_comm.send_json_to({"type": "set-status", "status": "away"})

    event = await receive_ignoring_presence_for_user(other_comm, str(me.id), expected_status="away")
    assert event == {"type": "presence.update", "user_id": str(me.id), "status": "away", "last_seen": None}

    await me_comm.disconnect()
    await other_comm.disconnect()


async def test_appear_offline_hides_presence_without_disconnecting_chat():
    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    await me_comm.send_json_to({"type": "set-status", "status": "offline"})
    event = await receive_ignoring_presence_for_user(other_comm, str(me.id), expected_status="offline")
    assert event["status"] == "offline"

    # Still genuinely connected — chat still works while "appearing" offline.
    await me_comm.send_json_to(
        {"type": "chat-message", "conversation_id": str(conversation.id), "content": "still here"}
    )
    delivered = await receive_until_type(other_comm, "chat.message")
    assert delivered["content"] == "still here"

    await me_comm.disconnect()
    await other_comm.disconnect()


async def test_closing_one_of_two_tabs_does_not_mark_the_user_offline():
    me = await sync_create_user()
    other = await sync_create_user()
    await sync_create_dm(me, other)

    other_comm = await connect_as(other)
    tab1 = await connect_as(me)
    await receive_ignoring_presence_for_user(
        other_comm, str(me.id), expected_status="online"
    )  # "me" came online

    tab2 = await connect_as(me)

    # Closing the first tab shouldn't announce "me" as offline — the second tab is still up.
    # (A redundant, idempotent "online" ping may still arrive if connects/disconnects overlap —
    # harmless on a real frontend — so the invariant that matters is checked directly: no
    # "offline" for "me" shows up while tab2 is still connected.)
    await tab1.disconnect()
    for _ in range(5):
        if await other_comm.receive_nothing(timeout=0.2):
            break
        msg = await other_comm.receive_json_from()
        assert not (
            msg.get("user_id") == str(me.id) and msg.get("status") == "offline"
        ), "me was reported offline while a second tab was still connected"

    # Closing the last tab does.
    await tab2.disconnect()
    event = await receive_ignoring_presence_for_user(other_comm, str(me.id), expected_status="offline")
    assert event["status"] == "offline"

    await other_comm.disconnect()


async def test_invalid_status_value_is_rejected():
    me = await sync_create_user()
    me_comm = await connect_as(me)

    await me_comm.send_json_to({"type": "set-status", "status": "extremely-busy"})
    event = await me_comm.receive_json_from()
    assert event == {
        "type": "error",
        "code": "invalid_status",
        "message": "Status must be online, away, or offline.",
    }

    await me_comm.disconnect()


# --- small sync->async helpers, since these tests talk to the ORM directly ---


@database_sync_to_async
def sync_create_user():
    return UserFactory(email_verified=True)


@database_sync_to_async
def sync_create_dm(user_a, user_b):
    conversation = Conversation.objects.create(type="dm")
    ConversationParticipant.objects.create(conversation=conversation, user=user_a)
    ConversationParticipant.objects.create(conversation=conversation, user=user_b)
    return conversation


@database_sync_to_async
def sync_create_message(conversation, sender, content):
    return Message.objects.create(conversation=conversation, sender=sender, content=content)


@database_sync_to_async
def sync_count_messages(conversation):
    return Message.objects.filter(conversation=conversation).count()


@database_sync_to_async
def sync_get_last_read(conversation, user):
    participant = ConversationParticipant.objects.get(conversation=conversation, user=user)
    return participant.last_read_message_id


# --- Phase 5 hardening: typing indicators (isolation, multi-typer, throttle, TTL) ---


async def test_typing_is_isolated_per_conversation():
    me = await sync_create_user()
    other = await sync_create_user()
    conv_a = await sync_create_dm(me, other)
    conv_b = await sync_create_dm(me, other)  # a second, distinct conversation between the same two people

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    await me_comm.send_json_to({"type": "typing", "conversation_id": str(conv_a.id), "is_typing": True})
    event = await receive_ignoring_presence(other_comm)
    assert event["conversation_id"] == str(conv_a.id)

    # Nothing about conv_b yet, even though it exists between the same two people.
    assert await other_comm.receive_nothing(timeout=0.3) is True

    # A typing event actually sent on conv_b is correctly tagged with conv_b's id,
    # not conflated with the conv_a state from a moment ago.
    await me_comm.send_json_to({"type": "typing", "conversation_id": str(conv_b.id), "is_typing": True})
    event_b = await receive_ignoring_presence(other_comm)
    assert event_b["conversation_id"] == str(conv_b.id)

    await me_comm.disconnect()
    await other_comm.disconnect()


async def test_multiple_users_typing_in_a_group_are_all_tracked_independently():
    host = await sync_create_user()
    a = await sync_create_user()
    b = await sync_create_user()
    conversation = await sync_create_group(host, a, b)

    host_comm = await connect_as(host)
    a_comm = await connect_as(a)
    b_comm = await connect_as(b)

    await a_comm.send_json_to({"type": "typing", "conversation_id": str(conversation.id), "is_typing": True})
    event1 = await receive_ignoring_presence(host_comm)
    assert event1 == {
        "type": "typing",
        "conversation_id": str(conversation.id),
        "user_id": str(a.id),
        "is_typing": True,
    }

    await b_comm.send_json_to({"type": "typing", "conversation_id": str(conversation.id), "is_typing": True})
    event2 = await receive_ignoring_presence(host_comm)
    assert event2["user_id"] == str(b.id)
    assert event2["is_typing"] is True

    # b shouldn't see themselves in their own typing broadcast, only a's.
    event_for_b = await receive_ignoring_presence(b_comm)
    assert event_for_b["user_id"] == str(a.id)

    await host_comm.disconnect()
    await a_comm.disconnect()
    await b_comm.disconnect()


async def test_rapid_typing_events_are_throttled():
    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    # Simulate keystroke spam: five "is_typing: true" sends back to back.
    for _ in range(5):
        await me_comm.send_json_to(
            {"type": "typing", "conversation_id": str(conversation.id), "is_typing": True}
        )

    first = await receive_ignoring_presence(other_comm)
    assert first["is_typing"] is True
    # The other four should have been throttled server-side — nothing more arrives.
    assert await other_comm.receive_nothing(timeout=0.5) is True

    await me_comm.disconnect()
    await other_comm.disconnect()


async def test_disconnecting_clears_typing_for_the_other_participant():
    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)

    me_comm = await connect_as(me)
    other_comm = await connect_as(other)

    await me_comm.send_json_to({"type": "typing", "conversation_id": str(conversation.id), "is_typing": True})
    started = await receive_ignoring_presence(other_comm)
    assert started["is_typing"] is True

    # "me" disconnects mid-type without ever sending is_typing: false.
    await me_comm.disconnect()

    stopped = await receive_ignoring_presence(other_comm)
    assert stopped == {
        "type": "typing",
        "conversation_id": str(conversation.id),
        "user_id": str(me.id),
        "is_typing": False,
    }

    await other_comm.disconnect()


# --- Phase 5 hardening: REST fallback broadcasts live, client_message_id concurrency ---


async def test_rest_fallback_send_is_broadcast_live_to_the_other_participant():
    """The REST endpoint itself is tested at the API layer (apps/messaging);
    this confirms the *live* delivery side specifically — that a message
    created outside the consumer still reaches a connected peer's socket."""
    from channels.db import database_sync_to_async as dsta

    from apps.messaging.services import get_or_create_message

    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)
    other_comm = await connect_as(other)

    @dsta
    def send_via_rest_path():
        from apps.messaging.views import _broadcast_message

        message, created = get_or_create_message(
            conversation=conversation, sender_id=me.id, content="via rest", client_message_id="rest-1"
        )
        # In the real view this runs inside transaction.on_commit; call it
        # directly here since there's no surrounding transaction in the test.
        _broadcast_message(message, exclude_user_id=str(me.id))
        return message

    await send_via_rest_path()

    delivered = await receive_ignoring_presence(other_comm)
    assert delivered["type"] == "chat.message"
    assert delivered["content"] == "via rest"

    await other_comm.disconnect()


async def test_concurrent_same_client_message_id_never_500s_or_duplicates():
    """Simulates the WS path and a REST-fallback retry racing on the same
    client_message_id — both attempting the create at once shouldn't ever
    raise an uncaught IntegrityError, and only one Message should exist."""
    import asyncio

    from apps.messaging.services import get_or_create_message

    me = await sync_create_user()
    other = await sync_create_user()
    conversation = await sync_create_dm(me, other)

    async def attempt():
        return await database_sync_to_async(get_or_create_message)(
            conversation=conversation, sender_id=me.id, content="race", client_message_id="same-key"
        )

    results = await asyncio.gather(*[attempt() for _ in range(5)], return_exceptions=True)

    for r in results:
        assert not isinstance(r, Exception), f"concurrent send raised: {r}"

    message_ids = {str(msg.id) for msg, _created in results}
    assert len(message_ids) == 1  # every concurrent attempt resolved to the same row
    assert await sync_count_messages(conversation) == 1


# --- extra helpers for the tests above ---


@database_sync_to_async
def sync_create_group(host, *others):
    conversation = Conversation.objects.create(type="group")
    ConversationParticipant.objects.create(conversation=conversation, user=host)
    for u in others:
        ConversationParticipant.objects.create(conversation=conversation, user=u)
    return conversation


# --- Phase 7: live meeting room + WebRTC signaling ---------------------------

async def receive_type(comm, expected_type, max_messages=20):
    for _ in range(max_messages):
        msg = await comm.receive_json_from()
        if msg.get("type") == expected_type:
            return msg
    raise AssertionError(f"Did not receive {expected_type}")


async def test_host_join_starts_scheduled_meeting_and_is_admitted():
    host = await sync_create_user()
    meeting = await sync_create_meeting(host, status="scheduled")
    comm = await connect_as(host)

    await comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    event = await receive_type(comm, "meeting.joined")

    assert event["status"] == "admitted"
    assert event["is_host"] is True
    assert await sync_get_meeting_status(meeting.id) == "live"

    await comm.disconnect()


async def test_accepted_invitee_can_join_live_meeting_without_waiting_room():
    host = await sync_create_user()
    invitee = await sync_create_user()
    meeting = await sync_create_meeting(host, status="live", waiting_room_enabled=False)
    await sync_invite(meeting, invitee, status="accepted")
    comm = await connect_as(invitee)

    await comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    event = await receive_type(comm, "meeting.joined")

    assert event["status"] == "admitted"
    assert event["participant"]["user_id"] == str(invitee.id)

    await comm.disconnect()


async def test_outsider_cannot_discover_or_join_meeting_over_websocket():
    host = await sync_create_user()
    outsider = await sync_create_user()
    meeting = await sync_create_meeting(host, status="live")
    comm = await connect_as(outsider)

    await comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    event = await receive_type(comm, "error")

    assert event["code"] == "meeting_not_found"
    await comm.disconnect()


async def test_waiting_room_user_can_be_admitted_by_host():
    host = await sync_create_user()
    invitee = await sync_create_user()
    meeting = await sync_create_meeting(host, status="live", waiting_room_enabled=True)
    await sync_invite(meeting, invitee, status="accepted")

    host_comm = await connect_as(host)
    invitee_comm = await connect_as(invitee)

    await host_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(host_comm, "meeting.joined")

    await invitee_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    waiting = await receive_type(invitee_comm, "meeting.joined")
    assert waiting["status"] == "waiting"

    # Host sees the waiting participant through the shared meeting group.
    host_update = await receive_type(host_comm, "meeting.participant.updated")
    while host_update["participant"]["user_id"] != str(invitee.id):
        host_update = await receive_type(host_comm, "meeting.participant.updated")
    assert host_update["participant"]["status"] == "waiting"

    await host_comm.send_json_to(
        {"type": "meeting-admit", "meeting_id": str(meeting.id), "user_id": str(invitee.id)}
    )
    admitted = await receive_type(invitee_comm, "meeting.admitted")
    assert admitted["participant"]["status"] == "admitted"

    await host_comm.disconnect()
    await invitee_comm.disconnect()


async def test_webrtc_offer_is_relayed_only_between_admitted_participants():
    host = await sync_create_user()
    invitee = await sync_create_user()
    meeting = await sync_create_meeting(host, status="live", waiting_room_enabled=False)
    await sync_invite(meeting, invitee, status="accepted")

    host_comm = await connect_as(host)
    invitee_comm = await connect_as(invitee)
    await host_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(host_comm, "meeting.joined")
    await invitee_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(invitee_comm, "meeting.joined")

    fake_offer = {"type": "offer", "sdp": "v=0-test"}
    await invitee_comm.send_json_to(
        {
            "type": "webrtc-offer",
            "meeting_id": str(meeting.id),
            "target_user_id": str(host.id),
            "sdp": fake_offer,
        }
    )
    relayed = await receive_type(host_comm, "webrtc.offer")
    assert relayed["from_user_id"] == str(invitee.id)
    assert relayed["sdp"] == fake_offer

    await host_comm.disconnect()
    await invitee_comm.disconnect()


@database_sync_to_async
def sync_create_meeting(host, status="scheduled", waiting_room_enabled=False):
    from datetime import timedelta
    from django.utils import timezone
    from apps.meetings.models import Meeting

    start = timezone.now() + timedelta(minutes=5)
    return Meeting.objects.create(
        host=host,
        title="Realtime meeting",
        scheduled_start=start,
        scheduled_end=start + timedelta(hours=1),
        status=status,
        waiting_room_enabled=waiting_room_enabled,
        actual_start=timezone.now() if status == "live" else None,
    )


@database_sync_to_async
def sync_invite(meeting, user, status="pending"):
    from apps.meetings.models import MeetingInvite

    return MeetingInvite.objects.create(meeting=meeting, invited_user=user, status=status)


@database_sync_to_async
def sync_get_meeting_status(meeting_id):
    from apps.meetings.models import Meeting

    return Meeting.objects.get(pk=meeting_id).status


async def test_media_state_including_screen_share_is_broadcast_inside_meeting():
    host = await sync_create_user()
    invitee = await sync_create_user()
    meeting = await sync_create_meeting(host, status="live", waiting_room_enabled=False)
    await sync_invite(meeting, invitee, status="accepted")

    host_comm = await connect_as(host)
    invitee_comm = await connect_as(invitee)
    await host_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(host_comm, "meeting.joined")
    await invitee_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(invitee_comm, "meeting.joined")

    await invitee_comm.send_json_to(
        {
            "type": "media-state",
            "meeting_id": str(meeting.id),
            "mic_enabled": True,
            "camera_enabled": True,
            "screen_sharing": True,
        }
    )
    event = await receive_type(host_comm, "meeting.media_state")
    assert event["user_id"] == str(invitee.id)
    assert event["screen_sharing"] is True

    await host_comm.disconnect()
    await invitee_comm.disconnect()

# --- Phase 9: collaborative meeting whiteboard -------------------------------

async def test_admitted_participant_whiteboard_stroke_is_persisted_and_broadcast():
    host = await sync_create_user()
    invitee = await sync_create_user()
    meeting = await sync_create_meeting(host, status="live", waiting_room_enabled=False)
    await sync_invite(meeting, invitee, status="accepted")

    host_comm = await connect_as(host)
    invitee_comm = await connect_as(invitee)
    await host_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(host_comm, "meeting.joined")
    await invitee_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(invitee_comm, "meeting.joined")

    stroke_id = "11111111-1111-4111-8111-111111111111"
    await invitee_comm.send_json_to(
        {
            "type": "whiteboard-stroke",
            "meeting_id": str(meeting.id),
            "stroke": {
                "id": stroke_id,
                "tool": "draw",
                "color": "#2563EB",
                "width": 4,
                "points": [{"x": 0.1, "y": 0.2}, {"x": 0.5, "y": 0.7}],
            },
        }
    )

    event = await receive_type(host_comm, "whiteboard.stroke")
    assert event["stroke"]["id"] == stroke_id
    assert event["stroke"]["author_id"] == str(invitee.id)
    assert event["stroke"]["points"] == [{"x": 0.1, "y": 0.2}, {"x": 0.5, "y": 0.7}]
    assert await sync_count_whiteboard_strokes(meeting.id) == 1

    await host_comm.disconnect()
    await invitee_comm.disconnect()


async def test_whiteboard_rejects_user_who_is_not_admitted_to_meeting():
    host = await sync_create_user()
    outsider = await sync_create_user()
    meeting = await sync_create_meeting(host, status="live")
    comm = await connect_as(outsider)

    await comm.send_json_to(
        {
            "type": "whiteboard-stroke",
            "meeting_id": str(meeting.id),
            "stroke": {
                "id": "22222222-2222-4222-8222-222222222222",
                "tool": "draw",
                "color": "#111827",
                "width": 4,
                "points": [{"x": 0.2, "y": 0.2}],
            },
        }
    )
    event = await receive_type(comm, "error")
    assert event["code"] == "whiteboard_not_allowed"
    assert await sync_count_whiteboard_strokes(meeting.id) == 0
    await comm.disconnect()


async def test_only_host_can_clear_whiteboard_and_clear_is_broadcast():
    host = await sync_create_user()
    invitee = await sync_create_user()
    meeting = await sync_create_meeting(host, status="live", waiting_room_enabled=False)
    await sync_invite(meeting, invitee, status="accepted")

    host_comm = await connect_as(host)
    invitee_comm = await connect_as(invitee)
    await host_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(host_comm, "meeting.joined")
    await invitee_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(invitee_comm, "meeting.joined")

    await invitee_comm.send_json_to(
        {
            "type": "whiteboard-stroke",
            "meeting_id": str(meeting.id),
            "stroke": {
                "id": "33333333-3333-4333-8333-333333333333",
                "tool": "draw",
                "color": "#16A34A",
                "width": 8,
                "points": [{"x": 0.3, "y": 0.3}],
            },
        }
    )
    await receive_type(host_comm, "whiteboard.stroke")

    await invitee_comm.send_json_to({"type": "whiteboard-clear", "meeting_id": str(meeting.id)})
    denied = await receive_type(invitee_comm, "error")
    assert denied["code"] == "host_required"
    assert await sync_count_whiteboard_strokes(meeting.id) == 1

    await host_comm.send_json_to({"type": "whiteboard-clear", "meeting_id": str(meeting.id)})
    cleared = await receive_type(invitee_comm, "whiteboard.cleared")
    assert cleared["cleared_by"] == str(host.id)
    assert await sync_count_whiteboard_strokes(meeting.id) == 0

    await host_comm.disconnect()
    await invitee_comm.disconnect()


async def test_participant_can_undo_only_their_latest_whiteboard_stroke():
    host = await sync_create_user()
    invitee = await sync_create_user()
    meeting = await sync_create_meeting(host, status="live", waiting_room_enabled=False)
    await sync_invite(meeting, invitee, status="accepted")

    host_comm = await connect_as(host)
    invitee_comm = await connect_as(invitee)
    await host_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(host_comm, "meeting.joined")
    await invitee_comm.send_json_to({"type": "meeting-join", "meeting_id": str(meeting.id)})
    await receive_type(invitee_comm, "meeting.joined")

    for stroke_id in [
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
    ]:
        await invitee_comm.send_json_to(
            {
                "type": "whiteboard-stroke",
                "meeting_id": str(meeting.id),
                "stroke": {
                    "id": stroke_id,
                    "tool": "draw",
                    "color": "#7C3AED",
                    "width": 2,
                    "points": [{"x": 0.4, "y": 0.4}],
                },
            }
        )
        await receive_type(host_comm, "whiteboard.stroke")

    await invitee_comm.send_json_to({"type": "whiteboard-undo", "meeting_id": str(meeting.id)})
    removed = await receive_type(host_comm, "whiteboard.removed")
    assert removed["stroke_id"] == "55555555-5555-4555-8555-555555555555"
    assert await sync_count_whiteboard_strokes(meeting.id) == 1

    await host_comm.disconnect()
    await invitee_comm.disconnect()


@database_sync_to_async
def sync_count_whiteboard_strokes(meeting_id):
    from apps.meetings.models import MeetingWhiteboardStroke

    return MeetingWhiteboardStroke.objects.filter(meeting_id=meeting_id).count()
