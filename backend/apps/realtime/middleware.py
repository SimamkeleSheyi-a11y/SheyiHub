from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache


@database_sync_to_async
def _get_user(user_id):
    from apps.users.models import User

    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class TicketAuthMiddleware:
    """Reads ?ticket=... from the WebSocket URL, resolves it to a user via
    the cache (set by apps.users.views.WsTicketView), and consumes it —
    a ticket is single-use. Falls back to AnonymousUser otherwise, so
    consumers can reject unauthenticated connections themselves."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        ticket = parse_qs(query_string).get("ticket", [None])[0]

        scope["user"] = AnonymousUser()
        if ticket:
            cache_key = f"ws-ticket:{ticket}"
            user_id = cache.get(cache_key)
            if user_id:
                cache.delete(cache_key)
                scope["user"] = await _get_user(user_id)

        return await self.app(scope, receive, send)


def TicketAuthMiddlewareStack(inner):
    return TicketAuthMiddleware(inner)
