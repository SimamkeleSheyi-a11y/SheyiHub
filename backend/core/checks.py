from django.conf import settings
from django.core.checks import Error, Tags, Warning, register


@register(Tags.security, deploy=True)
def sheyihub_deployment_checks(app_configs, **kwargs):
    issues = []

    secret = getattr(settings, "SECRET_KEY", "")
    if len(secret) < 32 or "insecure" in secret.lower() or "change-me" in secret.lower():
        issues.append(
            Error(
                "DJANGO_SECRET_KEY must be a strong production secret (32+ characters).",
                id="sheyihub.E001",
            )
        )

    if getattr(settings, "DEBUG", False):
        issues.append(Error("DEBUG must be False in production.", id="sheyihub.E002"))

    hosts = getattr(settings, "ALLOWED_HOSTS", [])
    if not hosts or "*" in hosts:
        issues.append(
            Error("Use an explicit DJANGO_ALLOWED_HOSTS list in production.", id="sheyihub.E003")
        )

    channel_backend = (
        getattr(settings, "CHANNEL_LAYERS", {})
        .get("default", {})
        .get("BACKEND", "")
    )
    if "InMemoryChannelLayer" in channel_backend:
        issues.append(
            Error("Production WebSockets must use the Redis channel layer.", id="sheyihub.E004")
        )

    frontend_url = getattr(settings, "FRONTEND_URL", "")
    if frontend_url and frontend_url.startswith("http://") and "localhost" not in frontend_url:
        issues.append(
            Warning("FRONTEND_URL should use HTTPS in production.", id="sheyihub.W001")
        )

    if not getattr(settings, "SECURE_SSL_REDIRECT", False):
        issues.append(Error("SECURE_SSL_REDIRECT must be enabled.", id="sheyihub.E005"))

    return issues
