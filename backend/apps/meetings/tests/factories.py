from datetime import timedelta

import factory
from django.utils import timezone

from apps.meetings.models import Meeting
from apps.users.tests.factories import UserFactory


class MeetingFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Meeting

    host = factory.SubFactory(UserFactory)
    title = factory.Sequence(lambda n: f"Meeting {n}")
    scheduled_start = factory.LazyFunction(lambda: timezone.now() + timedelta(hours=1))
    scheduled_end = factory.LazyFunction(lambda: timezone.now() + timedelta(hours=2))
