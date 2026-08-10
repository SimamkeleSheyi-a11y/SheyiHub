"""Shared message-creation logic used by both the WebSocket consumer and the
REST fallback endpoint, so the concurrency-safety fix lives in one place
instead of being duplicated (and possibly drifting) across both paths."""

from django.db import IntegrityError, transaction

from .models import Message


def get_or_create_message(*, conversation, sender_id, content, client_message_id=""):
    """
    Concurrency-safe idempotent create: a naive "check if it exists, then
    create" has a race — two near-simultaneous sends with the same
    client_message_id (e.g. a WebSocket send and a REST fallback retry
    firing close together) can both pass the "not found" check before
    either commits, then both attempt to insert, and the loser hits the
    unique constraint as an uncaught IntegrityError (a 500) instead of
    just returning the message that won.

    Returns (message, created).
    """
    if client_message_id:
        existing = Message.objects.filter(
            conversation=conversation, sender_id=sender_id, client_message_id=client_message_id
        ).first()
        if existing:
            return existing, False

    try:
        with transaction.atomic():
            message = Message.objects.create(
                conversation=conversation,
                sender_id=sender_id,
                content=content,
                client_message_id=client_message_id,
            )
        return message, True
    except IntegrityError:
        if not client_message_id:
            raise  # a real integrity error unrelated to idempotency — don't swallow it
        # Lost the race: someone else's concurrent request with the same
        # client_message_id committed first. Their message is the answer.
        return (
            Message.objects.get(
                conversation=conversation, sender_id=sender_id, client_message_id=client_message_id
            ),
            False,
        )
