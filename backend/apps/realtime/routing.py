from django.urls import re_path

from .consumers import UserConsumer

# A single personal channel per connected client (Phase 2 §6). Meeting-scoped
# routes (signaling, whiteboard) get added here once the video-calling phase
# implements that consumer.
websocket_urlpatterns = [
    re_path(r"^ws/connect/$", UserConsumer.as_asgi()),
]
