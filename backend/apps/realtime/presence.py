from django.core.cache import cache
from django.utils import timezone

VALID_MANUAL_STATUSES = {"online", "away", "offline"}


def _conn_key(user_id: str) -> str:
    return f"presence:conn-count:{user_id}"


def _manual_key(user_id: str) -> str:
    return f"presence:manual:{user_id}"


def _last_seen_key(user_id: str) -> str:
    return f"presence:last-seen:{user_id}"


def add_connection(user_id: str) -> int:
    """Registers one connection (one tab/device) and returns the count
    *after* adding it. Uses cache.add()+incr() — both atomic per Django's
    cache API contract — rather than a get/modify/set on a set object,
    which lost updates when two tabs for the same user connected close
    together (Phase 5 hardening #1)."""
    key = _conn_key(user_id)
    cache.add(key, 0, timeout=None)  # no-op if already present — atomic "create if absent"
    return cache.incr(key)


def remove_connection(user_id: str) -> int:
    """Removes one connection and returns the remaining count. Closing one
    of several tabs/devices only decrements — the others keep the user
    online (the multi-tab requirement)."""
    key = _conn_key(user_id)
    try:
        remaining = cache.decr(key)
    except ValueError:
        return 0  # nothing registered (shouldn't normally happen) — treat as offline
    if remaining <= 0:
        cache.delete(key)
        return 0
    return remaining


def connection_count(user_id: str) -> int:
    return cache.get(_conn_key(user_id)) or 0


def set_manual_status(user_id: str, status: str):
    if status not in VALID_MANUAL_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    cache.set(_manual_key(user_id), status, timeout=None)


def get_manual_status(user_id: str) -> str:
    return cache.get(_manual_key(user_id)) or "online"


def mark_last_seen(user_id: str):
    cache.set(_last_seen_key(user_id), timezone.now().isoformat(), timeout=None)


def get_effective_status(user_id: str) -> dict:
    """What OTHER users should see for this person right now — combining
    actual connectivity with their chosen visibility (Phase 5 hardening #1)."""
    if connection_count(user_id) <= 0:
        return {"status": "offline", "last_seen": cache.get(_last_seen_key(user_id))}

    manual = get_manual_status(user_id)
    if manual == "offline":
        # "Appear offline": genuinely connected, chat still works, but presence hides it.
        return {"status": "offline", "last_seen": None}
    return {"status": manual, "last_seen": None}  # "online" or "away"
