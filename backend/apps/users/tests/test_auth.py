import pytest
from django.core import mail
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from apps.users.models import User
from apps.users.tokens import email_verification_token, password_reset_token

from .factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


def test_register_creates_unverified_user_and_queues_email(client):
    resp = client.post(
        reverse("register"),
        {"email": "new@example.com", "password": "StrongPass123!", "display_name": "New User"},
    )
    assert resp.status_code == 201
    user = User.objects.get(email="new@example.com")
    assert user.email_verified is False
    assert len(mail.outbox) == 1
    assert "Verify your SheyiHub email" in mail.outbox[0].subject


def test_register_rejects_duplicate_email(client):
    UserFactory(email="taken@example.com")
    resp = client.post(
        reverse("register"),
        {"email": "taken@example.com", "password": "StrongPass123!", "display_name": "X"},
    )
    assert resp.status_code == 400


def test_register_rejects_weak_password(client):
    resp = client.post(
        reverse("register"), {"email": "a@example.com", "password": "123", "display_name": "X"}
    )
    assert resp.status_code == 400


def test_login_succeeds_before_verification_but_returns_verified_flag(client):
    UserFactory(email="a@example.com", password="StrongPass123!", email_verified=False)
    resp = client.post(reverse("login"), {"email": "a@example.com", "password": "StrongPass123!"})
    assert resp.status_code == 200
    assert "access" in resp.data
    assert resp.data["user"]["email_verified"] is False
    assert "sheyihub_refresh" in resp.cookies
    assert resp.cookies["sheyihub_refresh"]["httponly"] is True
    assert "sheyihub_csrf" in resp.cookies


def test_login_rejects_wrong_password(client):
    UserFactory(email="a@example.com", password="StrongPass123!")
    resp = client.post(reverse("login"), {"email": "a@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_refresh_requires_csrf_header_matching_cookie(client):
    UserFactory(email="a@example.com", password="StrongPass123!")
    login_resp = client.post(reverse("login"), {"email": "a@example.com", "password": "StrongPass123!"})
    csrf_value = login_resp.cookies["sheyihub_csrf"].value

    # No CSRF header at all -> rejected
    resp = client.post(reverse("refresh"))
    assert resp.status_code == 401

    # Correct header -> succeeds and rotates both cookies
    resp = client.post(reverse("refresh"), HTTP_X_CSRF_TOKEN=csrf_value)
    assert resp.status_code == 200
    assert "access" in resp.data


def test_logout_blacklists_refresh_token(client):
    UserFactory(email="a@example.com", password="StrongPass123!")
    login_resp = client.post(reverse("login"), {"email": "a@example.com", "password": "StrongPass123!"})
    access = login_resp.data["access"]

    resp = client.post(reverse("logout"), HTTP_AUTHORIZATION=f"Bearer {access}")
    assert resp.status_code == 204
    assert resp.cookies["sheyihub_refresh"].value == ""


def test_verify_email_with_valid_token(client):
    user = UserFactory(email_verified=False)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)

    resp = client.post(reverse("verify-email"), {"uid": uid, "token": token})
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.email_verified is True


def test_verify_email_with_invalid_token_fails(client):
    user = UserFactory(email_verified=False)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    resp = client.post(reverse("verify-email"), {"uid": uid, "token": "bogus"})
    assert resp.status_code == 400
    user.refresh_from_db()
    assert user.email_verified is False


def test_password_reset_request_does_not_leak_account_existence(client):
    resp_exists = client.post(reverse("password-reset-request"), {"email": "nobody@example.com"})
    UserFactory(email="real@example.com")
    resp_real = client.post(reverse("password-reset-request"), {"email": "real@example.com"})
    assert resp_exists.status_code == resp_real.status_code == 200
    assert resp_exists.data == resp_real.data


def test_password_reset_confirm_changes_password(client):
    user = UserFactory(password="OldPass123!")
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = password_reset_token.make_token(user)

    resp = client.post(
        reverse("password-reset-confirm"), {"uid": uid, "token": token, "new_password": "NewPass456!"}
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.check_password("NewPass456!")


def test_me_endpoint_requires_auth(client):
    resp = client.get(reverse("me"))
    assert resp.status_code == 401


def test_me_endpoint_returns_and_updates_profile(client):
    user = UserFactory(password="StrongPass123!", display_name="Old Name")
    login_resp = client.post(reverse("login"), {"email": user.email, "password": "StrongPass123!"})
    access = login_resp.data["access"]

    resp = client.get(reverse("me"), HTTP_AUTHORIZATION=f"Bearer {access}")
    assert resp.status_code == 200
    assert resp.data["display_name"] == "Old Name"

    resp = client.patch(
        reverse("me"),
        {
            "display_name": "New Name",
            "bio": "Building useful collaboration tools.",
            "avatar_url": "https://example.com/avatar.png",
            "theme_preference": "dark",
        },
        HTTP_AUTHORIZATION=f"Bearer {access}",
    )
    assert resp.status_code == 200
    assert resp.data["display_name"] == "New Name"
    assert resp.data["bio"] == "Building useful collaboration tools."
    assert resp.data["avatar_url"] == "https://example.com/avatar.png"
    assert resp.data["theme_preference"] == "dark"
    assert "created_at" in resp.data


def test_me_profile_rejects_bio_over_240_characters(client):
    user = UserFactory(password="StrongPass123!")
    login_resp = client.post(reverse("login"), {"email": user.email, "password": "StrongPass123!"})
    access = login_resp.data["access"]

    resp = client.patch(
        reverse("me"),
        {"bio": "x" * 241},
        HTTP_AUTHORIZATION=f"Bearer {access}",
    )
    assert resp.status_code == 400
