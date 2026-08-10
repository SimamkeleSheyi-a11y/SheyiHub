import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.messaging.models import Conversation, ConversationParticipant, Message
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_starting_a_dm_creates_conversation_with_both_participants():
    me = UserFactory(email_verified=True)
    other = UserFactory(email="other@example.com")
    resp = auth_client(me).post(reverse("conversation-list"), {"participant_emails": ["other@example.com"]})
    assert resp.status_code == 201
    conversation = Conversation.objects.get(pk=resp.data["id"])
    assert conversation.participants.count() == 2
    assert set(conversation.participants.values_list("user_id", flat=True)) == {me.id, other.id}


def test_starting_a_dm_twice_reuses_the_existing_conversation():
    me = UserFactory(email_verified=True)
    UserFactory(email="other@example.com")
    client = auth_client(me)
    first = client.post(reverse("conversation-list"), {"participant_emails": ["other@example.com"]})
    second = client.post(reverse("conversation-list"), {"participant_emails": ["other@example.com"]})
    assert first.data["id"] == second.data["id"]
    assert Conversation.objects.count() == 1


def test_unverified_user_cannot_start_a_conversation():
    me = UserFactory(email_verified=False)
    UserFactory(email="other@example.com")
    resp = auth_client(me).post(reverse("conversation-list"), {"participant_emails": ["other@example.com"]})
    assert resp.status_code == 403


def test_group_conversation_with_multiple_invitees():
    me = UserFactory(email_verified=True)
    UserFactory(email="a@example.com")
    UserFactory(email="b@example.com")
    resp = auth_client(me).post(
        reverse("conversation-list"), {"participant_emails": ["a@example.com", "b@example.com"]}
    )
    assert resp.status_code == 201
    assert resp.data["type"] == "group"


def test_list_only_returns_conversations_the_user_is_in():
    me = UserFactory(email_verified=True)
    stranger_a, stranger_b = UserFactory(), UserFactory()
    mine = Conversation.objects.create(type="dm")
    ConversationParticipant.objects.create(conversation=mine, user=me)
    ConversationParticipant.objects.create(conversation=mine, user=stranger_a)

    not_mine = Conversation.objects.create(type="dm")
    ConversationParticipant.objects.create(conversation=not_mine, user=stranger_a)
    ConversationParticipant.objects.create(conversation=not_mine, user=stranger_b)

    resp = auth_client(me).get(reverse("conversation-list"))
    ids = [c["id"] for c in (resp.data.get("results") or resp.data)]
    assert str(mine.id) in ids
    assert str(not_mine.id) not in ids


def test_stranger_cannot_read_messages_in_a_conversation_they_are_not_in():
    conversation = Conversation.objects.create(type="dm")
    participant = UserFactory()
    ConversationParticipant.objects.create(conversation=conversation, user=participant)
    stranger = UserFactory()

    resp = auth_client(stranger).get(reverse("conversation-messages", args=[conversation.id]))
    assert resp.status_code in (403, 404)


def test_sending_a_message_via_rest_fallback_updates_read_pointer():
    conversation = Conversation.objects.create(type="dm")
    me = UserFactory()
    other = UserFactory()
    ConversationParticipant.objects.create(conversation=conversation, user=me)
    ConversationParticipant.objects.create(conversation=conversation, user=other)

    resp = auth_client(me).post(reverse("conversation-send", args=[conversation.id]), {"content": "hey"})
    assert resp.status_code == 201
    assert Message.objects.filter(conversation=conversation, content="hey").exists()

    my_participant = ConversationParticipant.objects.get(conversation=conversation, user=me)
    assert my_participant.last_read_message.content == "hey"


def test_unread_count_excludes_own_messages():
    conversation = Conversation.objects.create(type="dm")
    me = UserFactory(email_verified=True)
    other = UserFactory()
    ConversationParticipant.objects.create(conversation=conversation, user=me)
    ConversationParticipant.objects.create(conversation=conversation, user=other)

    Message.objects.create(conversation=conversation, sender=me, content="from me")
    Message.objects.create(conversation=conversation, sender=other, content="from them")

    resp = auth_client(me).get(reverse("conversation-list"))
    data = next(c for c in (resp.data.get("results") or resp.data) if c["id"] == str(conversation.id))
    assert data["unread_count"] == 1


def test_conversation_list_exposes_other_participants_read_states():
    """Phase 5 hardening: group read receipts need the *current* read state
    up front, not only from live events that happen to arrive while the
    conversation view is open."""
    me = UserFactory(email_verified=True)
    other = UserFactory()
    conversation = Conversation.objects.create(type="dm")
    ConversationParticipant.objects.create(conversation=conversation, user=me)
    msg = Message.objects.create(conversation=conversation, sender=other, content="hi")
    ConversationParticipant.objects.create(conversation=conversation, user=other, last_read_message=msg)

    resp = auth_client(me).get(reverse("conversation-list"))
    data = next(c for c in (resp.data.get("results") or resp.data) if c["id"] == str(conversation.id))
    assert data["read_states"] == {str(other.id): str(msg.id)}


def test_conversation_list_omits_the_requesting_users_own_read_state():
    me = UserFactory(email_verified=True)
    other = UserFactory()
    conversation = Conversation.objects.create(type="dm")
    msg = Message.objects.create(conversation=conversation, sender=other, content="hi")
    ConversationParticipant.objects.create(conversation=conversation, user=me, last_read_message=msg)
    ConversationParticipant.objects.create(conversation=conversation, user=other)

    resp = auth_client(me).get(reverse("conversation-list"))
    data = next(c for c in (resp.data.get("results") or resp.data) if c["id"] == str(conversation.id))
    assert str(me.id) not in data["read_states"]
