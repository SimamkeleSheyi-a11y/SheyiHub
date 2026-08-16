from django.db.models import Count, Prefetch
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsEmailVerified

from .models import Workspace, WorkspaceMember, WorkspaceRole
from .serializers import AddWorkspaceMemberSerializer, WorkspaceMemberSerializer, WorkspaceSerializer


class WorkspaceListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    def get_queryset(self):
        memberships = WorkspaceMember.objects.filter(user=self.request.user).select_related("user")
        return (
            Workspace.objects.filter(memberships__user=self.request.user)
            .select_related("owner")
            .annotate(member_count=Count("memberships", distinct=True))
            .prefetch_related(Prefetch("memberships", queryset=memberships, to_attr="prefetched_memberships"))
            .distinct()
        )


class WorkspaceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    def get_queryset(self):
        memberships = WorkspaceMember.objects.filter(user=self.request.user).select_related("user")
        return (
            Workspace.objects.filter(memberships__user=self.request.user)
            .select_related("owner")
            .annotate(member_count=Count("memberships", distinct=True))
            .prefetch_related(Prefetch("memberships", queryset=memberships, to_attr="prefetched_memberships"))
            .distinct()
        )

    def update(self, request, *args, **kwargs):
        workspace = self.get_object()
        role = WorkspaceMember.objects.filter(workspace=workspace, user=request.user).values_list("role", flat=True).first()
        if role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            return Response({"detail": "Workspace admin access is required."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        workspace = self.get_object()
        if workspace.owner_id != request.user.id:
            return Response({"detail": "Only the workspace owner can delete it."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class WorkspaceMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    def get_workspace(self, request, workspace_id):
        return Workspace.objects.filter(pk=workspace_id, memberships__user=request.user).first()

    def get(self, request, workspace_id):
        workspace = self.get_workspace(request, workspace_id)
        if not workspace:
            return Response({"detail": "Workspace not found."}, status=status.HTTP_404_NOT_FOUND)
        members = WorkspaceMember.objects.filter(workspace=workspace).select_related("user")
        return Response(WorkspaceMemberSerializer(members, many=True).data)

    def post(self, request, workspace_id):
        workspace = self.get_workspace(request, workspace_id)
        if not workspace:
            return Response({"detail": "Workspace not found."}, status=status.HTTP_404_NOT_FOUND)
        actor_role = WorkspaceMember.objects.filter(workspace=workspace, user=request.user).values_list("role", flat=True).first()
        if actor_role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            return Response({"detail": "Workspace admin access is required."}, status=status.HTTP_403_FORBIDDEN)
        serializer = AddWorkspaceMemberSerializer(data=request.data, context={})
        serializer.is_valid(raise_exception=True)
        target_user = serializer.context["target_user"]
        membership, created = WorkspaceMember.objects.get_or_create(
            workspace=workspace,
            user=target_user,
            defaults={"role": serializer.validated_data["role"]},
        )
        if not created:
            return Response({"detail": "That user is already a workspace member."}, status=status.HTTP_409_CONFLICT)
        return Response(WorkspaceMemberSerializer(membership).data, status=status.HTTP_201_CREATED)


class WorkspaceMemberDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    def get_membership(self, request, workspace_id, member_id):
        return WorkspaceMember.objects.select_related("workspace", "user").filter(
            pk=member_id,
            workspace_id=workspace_id,
            workspace__memberships__user=request.user,
        ).first()

    def patch(self, request, workspace_id, member_id):
        membership = self.get_membership(request, workspace_id, member_id)
        if not membership:
            return Response({"detail": "Workspace member not found."}, status=status.HTTP_404_NOT_FOUND)
        actor_role = WorkspaceMember.objects.filter(workspace=membership.workspace, user=request.user).values_list("role", flat=True).first()
        if actor_role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            return Response({"detail": "Workspace admin access is required."}, status=status.HTTP_403_FORBIDDEN)
        if membership.role == WorkspaceRole.OWNER:
            return Response({"detail": "The owner role cannot be changed here."}, status=status.HTTP_400_BAD_REQUEST)
        role = request.data.get("role")
        if role not in [WorkspaceRole.ADMIN, WorkspaceRole.MEMBER]:
            return Response({"detail": "Role must be admin or member."}, status=status.HTTP_400_BAD_REQUEST)
        membership.role = role
        membership.save(update_fields=["role"])
        return Response(WorkspaceMemberSerializer(membership).data)

    def delete(self, request, workspace_id, member_id):
        membership = self.get_membership(request, workspace_id, member_id)
        if not membership:
            return Response({"detail": "Workspace member not found."}, status=status.HTTP_404_NOT_FOUND)
        actor_role = WorkspaceMember.objects.filter(workspace=membership.workspace, user=request.user).values_list("role", flat=True).first()
        if actor_role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            return Response({"detail": "Workspace admin access is required."}, status=status.HTTP_403_FORBIDDEN)
        if membership.role == WorkspaceRole.OWNER:
            return Response({"detail": "The workspace owner cannot be removed."}, status=status.HTTP_400_BAD_REQUEST)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
