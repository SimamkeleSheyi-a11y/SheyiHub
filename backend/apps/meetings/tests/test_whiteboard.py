from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.meetings.models import MeetingInvite, MeetingWhiteboardStroke
from apps.meetings.tests.factories import MeetingFactory
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_host_can_read_persisted_whiteboard_snapshot():
    host = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host)
    MeetingWhiteboardStroke.objects.create(
        meeting=meeting,
        author=host,
        tool="draw",
        color="#2563EB",
        width=4,
        points=[{"x": 0.1, "y": 0.2}, {"x": 0.7, "y": 0.8}],
    )

    response = auth_client(host).get(f"/api/meetings/{meeting.id}/whiteboard/")

    assert response.status_code == 200
    assert response.data["meeting_id"] == str(meeting.id)
    assert len(response.data["strokes"]) == 1
    assert response.data["strokes"][0]["author_name"] == host.display_name
    assert response.data["strokes"][0]["points"][1] == {"x": 0.7, "y": 0.8}


def test_accepted_invitee_can_reopen_whiteboard_after_meeting_ends():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email_verified=True)
    meeting = MeetingFactory(
        host=host,
        status="ended",
        actual_start=timezone.now() - timedelta(minutes=20),
        actual_end=timezone.now(),
    )
    MeetingInvite.objects.create(meeting=meeting, invited_user=invitee, status="accepted")
    MeetingWhiteboardStroke.objects.create(
        meeting=meeting,
        author=host,
        tool="erase",
        color="#000000",
        width=24,
        points=[{"x": 0.5, "y": 0.5}],
    )

    response = auth_client(invitee).get(f"/api/meetings/{meeting.id}/whiteboard/")

    assert response.status_code == 200
    assert len(response.data["strokes"]) == 1
    assert response.data["strokes"][0]["tool"] == "erase"


def test_pending_invitee_cannot_open_whiteboard_content():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host)
    MeetingInvite.objects.create(meeting=meeting, invited_user=invitee, status="pending")

    response = auth_client(invitee).get(f"/api/meetings/{meeting.id}/whiteboard/")

    assert response.status_code == 403


def test_outsider_cannot_discover_whiteboard_endpoint():
    host = UserFactory(email_verified=True)
    outsider = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host)

    response = auth_client(outsider).get(f"/api/meetings/{meeting.id}/whiteboard/")

    assert response.status_code == 404
