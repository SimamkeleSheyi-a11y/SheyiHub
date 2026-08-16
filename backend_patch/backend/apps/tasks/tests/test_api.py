import pytest
from rest_framework.test import APIClient

from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def auth_client(user):
    client = APIClient(); client.force_authenticate(user=user); return client


def make_workspace(client):
    return client.post("/api/workspaces/", {"name": "Project"}, format="json").data


def test_member_can_create_and_move_task():
    user = UserFactory(email_verified=True)
    client = auth_client(user)
    workspace = make_workspace(client)
    created = client.post("/api/tasks/", {"workspace": workspace["id"], "title": "Ship V4"}, format="json")
    assert created.status_code == 201
    moved = client.patch(f"/api/tasks/{created.data['id']}/", {"status": "in_progress"}, format="json")
    assert moved.status_code == 200
    assert moved.data["status"] == "in_progress"


def test_outsider_cannot_see_tasks():
    owner, outsider = UserFactory(email_verified=True), UserFactory(email_verified=True)
    owner_client = auth_client(owner)
    workspace = make_workspace(owner_client)
    task = owner_client.post("/api/tasks/", {"workspace": workspace["id"], "title": "Secret"}, format="json").data
    response = auth_client(outsider).get(f"/api/tasks/{task['id']}/")
    assert response.status_code == 404
