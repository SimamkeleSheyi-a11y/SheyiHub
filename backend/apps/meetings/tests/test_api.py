from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.meetings.models import Meeting, MeetingStatus
from apps.users.tests.factories import UserFactory

from .factories import MeetingFactory

pytestmark = pytest.mark.django_db


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def iso(dt):
    return dt.isoformat()


def test_verified_user_can_create_meeting():
    host = UserFactory(email_verified=True)
    client = auth_client(host)
    start = timezone.now() + timedelta(hours=1)
    resp = client.post(
        reverse("meeting-list"),
        {
            "title": "Standup",
            "scheduled_start": iso(start),
            "scheduled_end": iso(start + timedelta(minutes=30)),
        },
    )
    assert resp.status_code == 201
    assert resp.data["room_slug"]
    assert resp.data["host"]["id"] == str(host.id)


def test_unverified_user_cannot_create_meeting():
    host = UserFactory(email_verified=False)
    client = auth_client(host)
    start = timezone.now() + timedelta(hours=1)
    resp = client.post(
        reverse("meeting-list"),
        {
            "title": "Standup",
            "scheduled_start": iso(start),
            "scheduled_end": iso(start + timedelta(minutes=30)),
        },
    )
    assert resp.status_code == 403


def test_end_must_be_after_start():
    host = UserFactory(email_verified=True)
    client = auth_client(host)
    start = timezone.now() + timedelta(hours=1)
    resp = client.post(
        reverse("meeting-list"),
        {"title": "Bad", "scheduled_start": iso(start), "scheduled_end": iso(start - timedelta(minutes=5))},
    )
    assert resp.status_code == 400


def test_cannot_schedule_in_the_past():
    host = UserFactory(email_verified=True)
    client = auth_client(host)
    start = timezone.now() - timedelta(hours=1)
    resp = client.post(
        reverse("meeting-list"),
        {"title": "Bad", "scheduled_start": iso(start), "scheduled_end": iso(start + timedelta(minutes=30))},
    )
    assert resp.status_code == 400


def test_room_slugs_are_unique_across_meetings():
    host = UserFactory(email_verified=True)
    m1 = MeetingFactory(host=host)
    m2 = MeetingFactory(host=host)
    assert m1.room_slug != m2.room_slug


def test_invitee_email_creates_an_invite_and_grants_visibility():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email="invitee@example.com")
    client = auth_client(host)
    start = timezone.now() + timedelta(hours=1)
    resp = client.post(
        reverse("meeting-list"),
        {
            "title": "Planning",
            "scheduled_start": iso(start),
            "scheduled_end": iso(start + timedelta(minutes=30)),
            "invitee_emails": ["invitee@example.com"],
        },
    )
    assert resp.status_code == 201
    meeting_id = resp.data["id"]

    invitee_client = auth_client(invitee)
    detail = invitee_client.get(reverse("meeting-detail", args=[meeting_id]))
    assert detail.status_code == 200
    assert "invitee@example.com" in detail.data["invited_emails"]


def test_stranger_cannot_view_a_meeting_they_are_not_part_of():
    meeting = MeetingFactory()
    stranger = UserFactory()
    resp = auth_client(stranger).get(reverse("meeting-detail", args=[meeting.id]))
    assert resp.status_code in (403, 404)


def test_only_host_can_update_a_meeting():
    host = UserFactory()
    meeting = MeetingFactory(host=host)
    other = UserFactory()

    resp = auth_client(other).patch(reverse("meeting-detail", args=[meeting.id]), {"title": "Hijacked"})
    assert resp.status_code in (403, 404)

    resp = auth_client(host).patch(reverse("meeting-detail", args=[meeting.id]), {"title": "Renamed"})
    assert resp.status_code == 200
    meeting.refresh_from_db()
    assert meeting.title == "Renamed"


def test_only_host_can_cancel_a_meeting_and_it_is_a_soft_cancel():
    host = UserFactory()
    meeting = MeetingFactory(host=host)
    other = UserFactory()

    resp = auth_client(other).delete(reverse("meeting-detail", args=[meeting.id]))
    assert resp.status_code in (403, 404)

    resp = auth_client(host).delete(reverse("meeting-detail", args=[meeting.id]))
    assert resp.status_code == 204
    meeting.refresh_from_db()
    assert meeting.status == MeetingStatus.CANCELLED  # still exists — soft cancel, not a hard delete
    assert Meeting.objects.filter(id=meeting.id).exists()


def test_list_only_returns_meetings_the_user_is_involved_in():
    me = UserFactory(email_verified=True)
    mine = MeetingFactory(host=me)
    MeetingFactory()  # someone else's, unrelated

    resp = auth_client(me).get(reverse("meeting-list"))
    ids = [m["id"] for m in resp.data["results"]] if "results" in resp.data else [m["id"] for m in resp.data]
    assert str(mine.id) in ids
    assert len(ids) == 1


def test_scope_upcoming_excludes_cancelled_meetings():
    me = UserFactory(email_verified=True)
    upcoming = MeetingFactory(host=me)
    cancelled = MeetingFactory(host=me, status=MeetingStatus.CANCELLED)

    resp = auth_client(me).get(reverse("meeting-list"), {"scope": "upcoming"})
    data = resp.data["results"] if "results" in resp.data else resp.data
    ids = [m["id"] for m in data]
    assert str(upcoming.id) in ids
    assert str(cancelled.id) not in ids


def test_host_can_add_registered_participant_and_list_rsvp_status():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email="phase6-invitee@example.com")
    meeting = MeetingFactory(host=host)
    client = auth_client(host)

    created = client.post(
        reverse("meeting-participants", args=[meeting.id]),
        {"email": invitee.email},
        format="json",
    )
    assert created.status_code == 201
    assert created.data["user"]["id"] == str(invitee.id)
    assert created.data["status"] == "pending"

    listed = client.get(reverse("meeting-participants", args=[meeting.id]))
    assert listed.status_code == 200
    assert len(listed.data) == 1
    assert listed.data[0]["user"]["email"] == invitee.email


def test_only_host_can_manage_participants():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email="phase6-member@example.com")
    outsider = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host)
    host_client = auth_client(host)
    created = host_client.post(
        reverse("meeting-participants", args=[meeting.id]), {"email": invitee.email}, format="json"
    )
    invite_id = created.data["id"]

    outsider_client = auth_client(outsider)
    add = outsider_client.post(
        reverse("meeting-participants", args=[meeting.id]), {"email": "nobody@example.com"}, format="json"
    )
    assert add.status_code in (403, 404)

    remove = outsider_client.delete(reverse("meeting-remove-participant", args=[meeting.id, invite_id]))
    assert remove.status_code in (403, 404)


def test_host_can_remove_participant():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email="phase6-remove@example.com")
    meeting = MeetingFactory(host=host)
    client = auth_client(host)
    created = client.post(
        reverse("meeting-participants", args=[meeting.id]), {"email": invitee.email}, format="json"
    )

    removed = client.delete(reverse("meeting-remove-participant", args=[meeting.id, created.data["id"]]))
    assert removed.status_code == 204
    assert not meeting.invites.filter(invited_user=invitee).exists()


def test_invitee_can_accept_own_invitation():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email="phase6-accept@example.com")
    meeting = MeetingFactory(host=host)
    meeting.invites.create(invited_user=invitee)

    response = auth_client(invitee).post(
        reverse("meeting-respond", args=[meeting.id]), {"response": "accept"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["status"] == "accepted"
    assert meeting.invites.get(invited_user=invitee).status == "accepted"


def test_invitee_can_decline_own_invitation():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email="phase6-decline@example.com")
    meeting = MeetingFactory(host=host)
    meeting.invites.create(invited_user=invitee)

    response = auth_client(invitee).post(
        reverse("meeting-respond", args=[meeting.id]), {"response": "decline"}, format="json"
    )
    assert response.status_code == 200
    assert response.data["status"] == "declined"


def test_user_cannot_respond_to_someone_elses_invitation():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email="phase6-real-invitee@example.com")
    outsider = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host)
    meeting.invites.create(invited_user=invitee)

    response = auth_client(outsider).post(
        reverse("meeting-respond", args=[meeting.id]), {"response": "accept"}, format="json"
    )
    assert response.status_code == 404


def test_cancelled_scope_returns_only_cancelled_meetings():
    me = UserFactory(email_verified=True)
    MeetingFactory(host=me)
    cancelled = MeetingFactory(host=me, status=MeetingStatus.CANCELLED)

    response = auth_client(me).get(reverse("meeting-list"), {"scope": "cancelled"})
    data = response.data["results"] if "results" in response.data else response.data
    assert [row["id"] for row in data] == [str(cancelled.id)]


def test_history_scope_excludes_cancelled_meetings():
    me = UserFactory(email_verified=True)
    past_start = timezone.now() - timedelta(hours=2)
    past = MeetingFactory(
        host=me,
        scheduled_start=past_start,
        scheduled_end=past_start + timedelta(minutes=30),
    )
    MeetingFactory(
        host=me,
        status=MeetingStatus.CANCELLED,
        scheduled_start=past_start,
        scheduled_end=past_start + timedelta(minutes=30),
    )

    response = auth_client(me).get(reverse("meeting-list"), {"scope": "history"})
    data = response.data["results"] if "results" in response.data else response.data
    assert [row["id"] for row in data] == [str(past.id)]


def test_host_can_start_scheduled_meeting():
    host = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host, status=MeetingStatus.SCHEDULED)

    response = auth_client(host).post(reverse("meeting-start", args=[meeting.id]))

    assert response.status_code == 200
    meeting.refresh_from_db()
    assert meeting.status == MeetingStatus.LIVE
    assert meeting.actual_start is not None


def test_non_host_cannot_start_meeting():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host, status=MeetingStatus.SCHEDULED)
    meeting.invites.create(invited_user=invitee, status="accepted")

    response = auth_client(invitee).post(reverse("meeting-start", args=[meeting.id]))

    assert response.status_code in (403, 404)
    meeting.refresh_from_db()
    assert meeting.status == MeetingStatus.SCHEDULED


def test_host_can_end_live_meeting():
    host = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host, status=MeetingStatus.LIVE, actual_start=timezone.now())

    response = auth_client(host).post(reverse("meeting-end", args=[meeting.id]))

    assert response.status_code == 200
    meeting.refresh_from_db()
    assert meeting.status == MeetingStatus.ENDED
    assert meeting.actual_end is not None


def test_cancelled_meeting_cannot_be_started():
    host = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host, status=MeetingStatus.CANCELLED)

    response = auth_client(host).post(reverse("meeting-start", args=[meeting.id]))

    assert response.status_code == 400
    meeting.refresh_from_db()
    assert meeting.status == MeetingStatus.CANCELLED


def test_upcoming_scope_keeps_currently_live_meeting_visible():
    me = UserFactory(email_verified=True)
    start = timezone.now() - timedelta(minutes=10)
    live = MeetingFactory(
        host=me,
        status=MeetingStatus.LIVE,
        actual_start=start,
        scheduled_start=start,
        scheduled_end=start + timedelta(hours=1),
    )

    response = auth_client(me).get(reverse("meeting-list"), {"scope": "upcoming"})
    data = response.data["results"] if "results" in response.data else response.data

    assert str(live.id) in [row["id"] for row in data]


def test_meeting_chat_reuses_phase5_conversation_for_host_and_accepted_invitee():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host, status=MeetingStatus.LIVE, actual_start=timezone.now())
    meeting.invites.create(invited_user=invitee, status="accepted")

    host_response = auth_client(host).get(reverse("meeting-conversation", args=[meeting.id]))
    invitee_response = auth_client(invitee).get(reverse("meeting-conversation", args=[meeting.id]))

    assert host_response.status_code == 200
    assert invitee_response.status_code == 200
    assert host_response.data["id"] == invitee_response.data["id"]
    assert host_response.data["type"] == "meeting"


def test_pending_invitee_cannot_open_meeting_chat():
    host = UserFactory(email_verified=True)
    invitee = UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host)
    meeting.invites.create(invited_user=invitee, status="pending")

    response = auth_client(invitee).get(reverse("meeting-conversation", args=[meeting.id]))

    assert response.status_code == 403
