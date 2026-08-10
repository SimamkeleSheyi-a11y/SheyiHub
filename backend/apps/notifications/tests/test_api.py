import pytest
from rest_framework.test import APIClient

from apps.notifications.models import Notification, NotificationKind
from apps.notifications.services import create_notification
from apps.users.models import User


pytestmark = pytest.mark.django_db


def make_user(email):
    return User.objects.create_user(email=email, display_name=email.split("@")[0], password="StrongPass123!")


def test_notifications_are_scoped_and_markable():
    user = make_user("a@example.com")
    other = make_user("b@example.com")
    mine = Notification.objects.create(user=user, kind=NotificationKind.MESSAGE, title="Mine")
    Notification.objects.create(user=other, kind=NotificationKind.MESSAGE, title="Other")

    client = APIClient()
    client.force_authenticate(user)

    response = client.get("/api/notifications/")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["title"] == "Mine"

    response = client.get("/api/notifications/unread-count")
    assert response.data == {"count": 1}

    response = client.post(f"/api/notifications/{mine.id}/read")
    assert response.status_code == 204
    mine.refresh_from_db()
    assert mine.read_at is not None


def test_mark_all_read_and_preferences():
    user = make_user("prefs@example.com")
    Notification.objects.create(user=user, kind=NotificationKind.MESSAGE, title="One")
    Notification.objects.create(user=user, kind=NotificationKind.FILE_SHARED, title="Two")
    client = APIClient()
    client.force_authenticate(user)

    response = client.patch(
        "/api/notifications/preferences",
        {"messages_enabled": False, "browser_enabled": True},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["messages_enabled"] is False
    assert response.data["browser_enabled"] is True

    response = client.post("/api/notifications/mark-all-read")
    assert response.status_code == 200
    assert response.data["updated"] == 2
    assert Notification.objects.filter(user=user, read_at__isnull=True).count() == 0


def test_preference_blocks_message_notification():
    user = make_user("blocked@example.com")
    client = APIClient()
    client.force_authenticate(user)
    client.patch("/api/notifications/preferences", {"messages_enabled": False}, format="json")

    result = create_notification(
        user_id=user.id,
        kind=NotificationKind.MESSAGE,
        title="Should not exist",
    )
    assert result is None
    assert Notification.objects.filter(user=user).count() == 0
