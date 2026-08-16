
import re

import pytest
from django.core import mail
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.users.models import EmailVerificationCode, User

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def client():
    return APIClient()


def _register(client, email="verify@example.com"):
    response = client.post(
        reverse("register"),
        {
            "email": email,
            "password": "StrongPass123!",
            "display_name": "Verify Me",
        },
    )
    assert response.status_code == 201
    return User.objects.get(email=email)


def _code_from_last_email():
    match = re.search(r"\b(\d{6})\b", mail.outbox[-1].body)
    assert match is not None
    return match.group(1)


def test_registration_creates_hashed_verification_code_and_sends_six_digits(client):
    user = _register(client)

    record = EmailVerificationCode.objects.get(user=user)
    code = _code_from_last_email()

    assert len(code) == 6
    assert code.isdigit()
    assert record.code_hash
    assert record.code_hash != code
    assert user.email_verified is False


def test_valid_code_verifies_account_and_deletes_pending_code(client):
    user = _register(client)
    code = _code_from_last_email()

    response = client.post(
        reverse("verify-email-code"),
        {"email": user.email, "code": code},
    )

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.email_verified is True
    assert not EmailVerificationCode.objects.filter(user=user).exists()


def test_wrong_code_does_not_verify_account(client):
    user = _register(client)

    response = client.post(
        reverse("verify-email-code"),
        {"email": user.email, "code": "000000"},
    )

    assert response.status_code == 400
    user.refresh_from_db()
    assert user.email_verified is False


def test_resend_is_anonymous_and_does_not_leak_unknown_account(client):
    response = client.post(
        reverse("resend-verification"),
        {"email": "nobody@example.com"},
    )

    assert response.status_code == 200
    assert "detail" in response.data
    assert "cooldown_seconds" in response.data
