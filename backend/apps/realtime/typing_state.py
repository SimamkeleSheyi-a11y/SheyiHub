from django.core.cache import cache

TYPING_TTL_SECONDS = 5  # matches the frontend's own receiver-side expiry (Phase 5 hardening)
THROTTLE_SECONDS = 1  # don't re-broadcast "still typing" more than once per second per user


def _typing_key(conversation_id: str, user_id: str) -> str:
    return f"typing:{conversation_id}:{user_id}"


def _throttle_key(conversation_id: str, user_id: str) -> str:
    return f"typing-throttle:{conversation_id}:{user_id}"


def _user_conversations_key(user_id: str) -> str:
    return f"typing-convs:{user_id}"


def mark_typing(conversation_id: str, user_id: str):
    """Records that this user is typing in this conversation, with a TTL —
    if nothing refreshes it, it naturally expires. Also tracks *which*
    conversations a user is typing in, so disconnect() can notify the
    right peers immediately instead of waiting out the TTL."""
    cache.set(_typing_key(conversation_id, user_id), True, timeout=TYPING_TTL_SECONDS)
    convs = cache.get(_user_conversations_key(user_id)) or set()
    cache.set(_user_conversations_key(user_id), convs | {conversation_id}, timeout=TYPING_TTL_SECONDS + 5)


def clear_typing(conversation_id: str, user_id: str):
    cache.delete(_typing_key(conversation_id, user_id))
    cache.delete(_throttle_key(conversation_id, user_id))
    convs = (cache.get(_user_conversations_key(user_id)) or set()) - {conversation_id}
    if convs:
        cache.set(_user_conversations_key(user_id), convs, timeout=TYPING_TTL_SECONDS + 5)
    else:
        cache.delete(_user_conversations_key(user_id))


def should_throttle(conversation_id: str, user_id: str) -> bool:
    """True if we already broadcast a "typing" for this user+conversation
    within the throttle window — caller should skip re-broadcasting."""
    key = _throttle_key(conversation_id, user_id)
    if cache.get(key):
        return True
    cache.set(key, True, timeout=THROTTLE_SECONDS)
    return False


def get_typing_conversations(user_id: str) -> set:
    return cache.get(_user_conversations_key(user_id)) or set()
