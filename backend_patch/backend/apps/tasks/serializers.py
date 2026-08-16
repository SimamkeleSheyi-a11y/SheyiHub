from rest_framework import serializers

from apps.workspaces.models import Workspace, WorkspaceMember

from .models import WorkspaceTask


class TaskAssigneeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    display_name = serializers.CharField()
    avatar_url = serializers.URLField(allow_blank=True)
    email = serializers.EmailField()


class WorkspaceTaskSerializer(serializers.ModelSerializer):
    assignee = TaskAssigneeSerializer(read_only=True)
    assignee_id = serializers.UUIDField(write_only=True, allow_null=True, required=False)
    created_by_name = serializers.CharField(source="created_by.display_name", read_only=True, default="")

    class Meta:
        model = WorkspaceTask
        fields = [
            "id", "workspace", "title", "description", "status", "priority", "position",
            "assignee", "assignee_id", "created_by_name", "due_date", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_by_name", "created_at", "updated_at"]

    def validate_workspace(self, workspace: Workspace):
        request = self.context["request"]
        if not WorkspaceMember.objects.filter(workspace=workspace, user=request.user).exists():
            raise serializers.ValidationError("You are not a member of this workspace.")
        return workspace

    def validate(self, attrs):
        workspace = attrs.get("workspace") or getattr(self.instance, "workspace", None)
        assignee_id = attrs.pop("assignee_id", serializers.empty)
        if assignee_id is not serializers.empty:
            if assignee_id is None:
                attrs["assignee"] = None
            else:
                membership = WorkspaceMember.objects.filter(workspace=workspace, user_id=assignee_id).select_related("user").first()
                if not membership:
                    raise serializers.ValidationError({"assignee_id": ["Assignee must be a workspace member."]})
                attrs["assignee"] = membership.user
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        if "position" not in validated_data:
            workspace = validated_data["workspace"]
            status = validated_data.get("status", "todo")
            last_position = WorkspaceTask.objects.filter(workspace=workspace, status=status).order_by("-position").values_list("position", flat=True).first() or 0
            validated_data["position"] = last_position + 1
        return WorkspaceTask.objects.create(created_by=request.user, **validated_data)
