from rest_framework.permissions import BasePermission

from .models import WorkspaceMember, WorkspaceRole


def workspace_role(user, workspace):
    if not user or not user.is_authenticated:
        return None
    membership = WorkspaceMember.objects.filter(workspace=workspace, user=user).only("role").first()
    return membership.role if membership else None


class IsWorkspaceMember(BasePermission):
    message = "You are not a member of this workspace."

    def has_object_permission(self, request, view, obj):
        workspace = getattr(obj, "workspace", obj)
        return WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists()


class IsWorkspaceAdmin(BasePermission):
    message = "Workspace admin access is required."

    def has_object_permission(self, request, view, obj):
        workspace = getattr(obj, "workspace", obj)
        return WorkspaceMember.objects.filter(
            workspace=workspace,
            user=request.user,
            role__in=[WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
        ).exists()
