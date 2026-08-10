import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

# django_asgi_app must be created before importing anything that touches
# models/apps, per Channels' documented startup order.
django_asgi_app = get_asgi_application()

from apps.realtime import routing  # noqa: E402
from apps.realtime.middleware import TicketAuthMiddlewareStack  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            TicketAuthMiddlewareStack(URLRouter(routing.websocket_urlpatterns))
        ),
    }
)
