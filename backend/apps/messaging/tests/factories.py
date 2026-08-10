import factory

from apps.messaging.models import Conversation, ConversationType


class ConversationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Conversation

    type = ConversationType.DM
