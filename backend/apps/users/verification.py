from __future__ import annotations

import math
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.utils import timezone

from .models import EmailVerificationCode, User


def verification_ttl_seconds() -> int:
    return int(getattr(settings, "EMAIL_VERIFICATION_CODE_TTL", 10 * 60))


def resend_cooldown_seconds() -> int:
    return int(getattr(settings, "EMAIL_VERIFICATION_RESEND_COOLDOWN", 60))


def max_verification_attempts() -> int:
    return int(getattr(settings, "EMAIL_VERIFICATION_MAX_ATTEMPTS", 5))


def issue_verification_code(
    user: User,
    *,
    force: bool = False,
) -> tuple[str | None, int]:
    """
    Create a new six-digit code and store only its password-style hash.

    Returns (raw_code_or_none, seconds_until_resend).
    If cooldown is still active, raw_code_or_none is None.
    """
    if user.email_verified:
        return None, 0

    now = timezone.now()
    cooldown = resend_cooldown_seconds()

    record, _ = EmailVerificationCode.objects.get_or_create(user=user)

    if not force and record.sent_at is not None:
        elapsed = (now - record.sent_at).total_seconds()
        remaining = cooldown - elapsed
        if remaining > 0:
            return None, max(1, math.ceil(remaining))

    code = f"{secrets.randbelow(1_000_000):06d}"
    record.code_hash = make_password(code)
    record.expires_at = now + timedelta(seconds=verification_ttl_seconds())
    record.sent_at = now
    record.attempts = 0
    record.save(update_fields=["code_hash", "expires_at", "sent_at", "attempts"])

    return code, cooldown
