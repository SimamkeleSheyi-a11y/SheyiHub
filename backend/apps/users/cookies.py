import secrets

from django.conf import settings

CSRF_COOKIE_NAME = "sheyihub_csrf"
CSRF_HEADER_NAME = "HTTP_X_CSRF_TOKEN"


def set_auth_cookies(response, refresh_token: str):
    """
    Refresh token: httpOnly, unreadable by JS — the whole point (Phase 2 §9).
    CSRF token: a plain, JS-readable cookie the frontend must echo back in a
    header on refresh/logout (double-submit pattern) — an attacker's page
    can ride the cookie but can't read it to put in the header.
    """
    secure = getattr(settings, "REFRESH_COOKIE_SECURE", True)
    same_site = getattr(settings, "REFRESH_COOKIE_SAMESITE", "Strict")
    cookie_domain = getattr(settings, "REFRESH_COOKIE_DOMAIN", None)

    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh_token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        domain=cookie_domain,
        path=settings.REFRESH_COOKIE_PATH,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
    )
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        CSRF_COOKIE_NAME,
        csrf_token,
        httponly=False,
        secure=secure,
        samesite=same_site,
        domain=cookie_domain,
        path=settings.REFRESH_COOKIE_PATH,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
    )
    return response


def clear_auth_cookies(response):
    domain = getattr(settings, "REFRESH_COOKIE_DOMAIN", None)
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH, domain=domain)
    response.delete_cookie(CSRF_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH, domain=domain)
    return response


def verify_csrf(request):
    cookie_value = request.COOKIES.get(CSRF_COOKIE_NAME)
    header_value = request.META.get(CSRF_HEADER_NAME)
    return bool(cookie_value) and bool(header_value) and secrets.compare_digest(cookie_value, header_value)
