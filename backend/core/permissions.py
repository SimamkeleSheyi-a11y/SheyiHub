from rest_framework.permissions import BasePermission


class IsEmailVerified(BasePermission):
    """
    Gates any action that requires a verified account (Phase 2 §5).
    Combine with IsAuthenticated (already the default) — this only checks
    the extra `email_verified` condition.
    """

    message = "Please verify your email address to do this."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.email_verified)
