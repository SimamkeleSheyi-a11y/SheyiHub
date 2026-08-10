"""Development Docker settings: real Postgres/Redis/Channels, console email."""

from .development import *  # noqa: F401,F403

DATABASES = {"default": env.db("DATABASE_URL")}  # noqa: F405

REDIS_URL = env("REDIS_URL", default="redis://redis:6379/0")  # noqa: F405
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
        "KEY_PREFIX": "sheyihub-dev",
    }
}
CELERY_TASK_ALWAYS_EAGER = False
