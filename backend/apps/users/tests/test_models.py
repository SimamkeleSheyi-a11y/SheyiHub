import uuid

import pytest

from apps.users.models import User

pytestmark = pytest.mark.django_db


def test_user_has_uuid_primary_key():
    user = User.objects.create_user(email="a@example.com", password="x", display_name="A")
    assert isinstance(user.id, uuid.UUID)


def test_email_is_normalized_and_required():
    user = User.objects.create_user(email="Test@Example.com", password="x", display_name="A")
    assert user.email == "test@example.com"

    with pytest.raises(ValueError):
        User.objects.create_user(email="", password="x", display_name="A")


def test_new_user_is_unverified_by_default():
    user = User.objects.create_user(email="a@example.com", password="x", display_name="A")
    assert user.email_verified is False


def test_password_is_hashed_not_plaintext():
    user = User.objects.create_user(email="a@example.com", password="secret123", display_name="A")
    assert user.password != "secret123"
    assert user.check_password("secret123")


def test_superuser_is_staff_and_verified():
    admin = User.objects.create_superuser(email="admin@example.com", password="x", display_name="Admin")
    assert admin.is_staff and admin.is_superuser and admin.email_verified


def test_profile_polish_fields_have_safe_defaults():
    user = User.objects.create_user(email="profile@example.com", password="x", display_name="Profile")
    assert user.bio == ""
    assert user.avatar_url == ""
    assert user.theme_preference == "system"
