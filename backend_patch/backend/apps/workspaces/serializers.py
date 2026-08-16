from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from .models import Workspace, WorkspaceMember, WorkspaceRole

User = get_user_model()


class WorkspaceSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Workspace
        fields = ["id", "name", "slug", "description", "role", "member_count", "created_at", "updated_at"]
        read_only_fields = ["id", "slug", "role", "member_count", "created_at", "updated_at"]

    def get_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        membership = next((m for m in getattr(obj, "prefetched_memberships", []) if m.user_id == request.user.id), None)
        if membership:
            return membership.role
        return WorkspaceMember.objects.filter(workspace=obj, user=request.user).values_list("role", flat=True).first()

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        workspace = Workspace.objects.create(owner=request.user, **validated_data)
        WorkspaceMember.objects.create(workspace=workspace, user=request.user, role=WorkspaceRole.OWNER)
        workspace.member_count = 1
        return workspace


class WorkspaceMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.id", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    display_name = serializers.CharField(source="user.display_name", read_only=True)
    avatar_url = serializers.URLField(source="user.avatar_url", read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = ["id", "user_id", "email", "display_name", "avatar_url", "role", "joined_at"]
        read_only_fields = ["id", "user_id", "email", "display_name", "avatar_url", "joined_at"]


class AddWorkspaceMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=[WorkspaceRole.ADMIN, WorkspaceRole.MEMBER], default=WorkspaceRole.MEMBER)

    def validate_email(self, value):
        user = User.objects.filter(email__iexact=value.strip()).first()
        if not user:
            raise serializers.ValidationError("No SheyiHub account uses that email yet.")
        self.context["target_user"] = user
        return value
