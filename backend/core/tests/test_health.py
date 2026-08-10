import pytest
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_health_endpoint_checks_database_and_cache(client):
    response = client.get(reverse("health"))
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_security_permissions_policy_header_is_present(client):
    response = client.get(reverse("health"))
    policy = response.headers.get("Permissions-Policy", "")
    assert "camera=(self)" in policy
    assert "microphone=(self)" in policy
