from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

# SQLite for local dev/tests — fast, zero setup. Production uses Postgres
# (see production.py). Both go through Django's ORM so this doesn't affect
# app code; it's a pragmatic dev/test choice, not an architecture change.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

CORS_ALLOW_ALL_ORIGINS = True
CSRF_TRUSTED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

CELERY_TASK_ALWAYS_EAGER = True  # run tasks synchronously in dev, no worker needed

REFRESH_COOKIE_SECURE = False

# LocMemCache is fine for dev (single runserver process). Backs the WS
# auth-ticket store (apps.users.views.WsTicketView) — production uses Redis
# since Gunicorn workers are separate processes that need to share it.
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
