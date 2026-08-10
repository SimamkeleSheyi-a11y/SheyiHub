from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

from .models import Notification, NotificationKind, NotificationPreference


_KIND_TO_PREF = {
    NotificationKind.MESSAGE: "messages_enabled",
    NotificationKind.MEETING_INVITE: "meetings_enabled",
    NotificationKind.MEETING_RESPONSE: "meetings_enabled",
    NotificationKind.MEETING_STARTED: "meetings_enabled",
    NotificationKind.FILE_SHARED: "files_enabled",
}


def _is_enabled(user_id, kind):
    preferences, _ = NotificationPreference.objects.get_or_create(user_id=user_id)
    field = _KIND_TO_PREF.get(kind)
    return True if field is None else bool(getattr(preferences, field))


def create_notification(*, user_id, kind, title, body="", target_url="", actor_id=None):
    """Persist and broadcast an in-app notification after the DB commit.

    The notification is deliberately generated server-side so unread state
    survives refreshes, reconnects, and browser restarts.
    """
    if actor_id is not None and str(actor_id) == str(user_id):
        return None
    if not _is_enabled(user_id, kind):
        return None

    notification = Notification.objects.create(
        user_id=user_id,
        actor_id=actor_id,
        kind=kind,
        title=title,
        body=body,
        target_url=target_url,
    )

    def _broadcast():
        from .serializers import NotificationSerializer

        payload = NotificationSerializer(notification).data
        payload["id"] = str(payload["id"])
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {"type": "notification.created", "notification": payload},
        )

    transaction.on_commit(_broadcast)
    return notification
