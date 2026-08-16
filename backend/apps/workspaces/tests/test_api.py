import pytest
from rest_framework.test import APIClient

from apps.users.tests.factories import UserFactory
from apps.workspaces.models import WorkspaceMember, WorkspaceRole

pytestmark = pytest.mark.django_db


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_create_workspace_makes_creator_owner():
    user = UserFactory(email_verified=True)
    response = auth_client(user).post("/api/workspaces/", {"name": "AMBLE Team"}, format="json")
    assert response.status_code == 201
    assert WorkspaceMember.objects.filter(workspace_id=response.data["id"], user=user, role=WorkspaceRole.OWNER).exists()


def test_workspace_list_excludes_outsider():
    owner, outsider = UserFactory(email_verified=True), UserFactory(email_verified=True)
    created = auth_client(owner).post("/api/workspaces/", {"name": "Private"}, format="json")
    response = auth_client(outsider).get("/api/workspaces/")
    assert response.status_code == 200
    ids = [item["id"] for item in response.data.get("results", response.data)]
    assert created.data["id"] not in ids


def test_admin_can_add_member():
    owner = UserFactory(email_verified=True)
    teammate = UserFactory(email_verified=True)
    client = auth_client(owner)
    workspace = client.post("/api/workspaces/", {"name": "Team"}, format="json").data
    response = client.post(f"/api/workspaces/{workspace['id']}/members/", {"email": teammate.email}, format="json")
    assert response.status_code == 201
    assert response.data["email"] == teammate.email
