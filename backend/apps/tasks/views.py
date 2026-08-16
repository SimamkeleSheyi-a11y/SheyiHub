from rest_framework import generics, permissions

from core.permissions import IsEmailVerified
from apps.workspaces.models import WorkspaceMember

from .models import WorkspaceTask
from .serializers import WorkspaceTaskSerializer


class WorkspaceTaskListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkspaceTaskSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    def get_queryset(self):
        queryset = WorkspaceTask.objects.filter(workspace__memberships__user=self.request.user).select_related(
            "workspace", "assignee", "created_by"
        ).distinct()
        workspace_id = self.request.query_params.get("workspace")
        if workspace_id:
            queryset = queryset.filter(workspace_id=workspace_id)
        status_value = self.request.query_params.get("status")
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset


class WorkspaceTaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WorkspaceTaskSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    def get_queryset(self):
        return WorkspaceTask.objects.filter(workspace__memberships__user=self.request.user).select_related(
            "workspace", "assignee", "created_by"
        ).distinct()
