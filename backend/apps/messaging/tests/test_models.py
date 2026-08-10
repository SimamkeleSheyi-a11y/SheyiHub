import pytest
from django.db import IntegrityError

from apps.messaging.models import Conversation, ConversationParticipant, Message
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_conversation_participant_uniqueness():
    conversation = Conversation.objects.create(type="dm")
    user = UserFactory()
    ConversationParticipant.objects.create(conversation=conversation, user=user)
    with pytest.raises(IntegrityError):
        ConversationParticipant.objects.create(conversation=conversation, user=user)


def test_messages_order_oldest_first():
    conversation = Conversation.objects.create(type="dm")
    sender = UserFactory()
    m1 = Message.objects.create(conversation=conversation, sender=sender, content="first")
    m2 = Message.objects.create(conversation=conversation, sender=sender, content="second")
    ordered = list(conversation.messages.all())
    assert ordered == [m1, m2]
