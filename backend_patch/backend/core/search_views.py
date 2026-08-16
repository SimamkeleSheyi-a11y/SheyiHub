from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsEmailVerified
from apps.meetings.models import Meeting
from apps.messaging.models import Message
from apps.tasks.models import WorkspaceTask
from apps.workspaces.models import Workspace

User = get_user_model()


class GlobalSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsEmailVerified]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response({"results": []})

        results = []

        for workspace in Workspace.objects.filter(memberships__user=request.user).filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        ).distinct()[:5]:
            results.append({
                "id": str(workspace.id),
                "kind": "workspace",
                "label": workspace.name,
                "subtitle": workspace.description or "Workspace",
                "target_url": "/workspaces",
            })

        for task in WorkspaceTask.objects.filter(workspace__memberships__user=request.user).filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        ).select_related("workspace").distinct()[:5]:
            results.append({
                "id": str(task.id),
                "kind": "task",
                "label": task.title,
                "subtitle": f"{task.workspace.name} · {task.get_status_display()}",
                "target_url": "/tasks",
            })

        for meeting in Meeting.objects.filter(
            Q(host=request.user) | Q(invites__invited_user=request.user) | Q(participants__user=request.user)
        ).filter(title__icontains=query).distinct()[:5]:
            results.append({
                "id": str(meeting.id),
                "kind": "meeting",
                "label": meeting.title,
                "subtitle": f"Meeting · {meeting.get_status_display()}",
                "target_url": f"/meetings/{meeting.id}",
            })

        for message in Message.objects.filter(conversation__participants__user=request.user, content__icontains=query).select_related("sender").distinct().order_by("-sent_at")[:5]:
            snippet = message.content[:90] + ("…" if len(message.content) > 90 else "")
            results.append({
                "id": str(message.id),
                "kind": "message",
                "label": snippet,
                "subtitle": f"Message from {message.sender.display_name}",
                "target_url": f"/chats/{message.conversation_id}",
            })

        for user in User.objects.filter(Q(display_name__icontains=query) | Q(email__icontains=query)).exclude(pk=request.user.pk)[:5]:
            results.append({
                "id": str(user.id),
                "kind": "person",
                "label": user.display_name,
                "subtitle": user.email,
                "target_url": "/chats",
            })

        return Response({"results": results[:20]})
