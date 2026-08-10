import secrets
import string

_ALPHABET = string.ascii_lowercase + string.digits
_SEGMENT_LEN = 3
_SEGMENTS = 3


def generate_room_slug() -> str:
    """e.g. 'xk3-9fq-2mp' — short and URL-safe, and deliberately not the
    database id, so a leaked link can be rotated without touching the
    Meeting's primary key (Phase 2 §9, closes Phase 1 EC-18)."""
    parts = ["".join(secrets.choice(_ALPHABET) for _ in range(_SEGMENT_LEN)) for _ in range(_SEGMENTS)]
    return "-".join(parts)
