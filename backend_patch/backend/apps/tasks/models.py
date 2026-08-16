import uuid

from django.conf import settings
from django.db import models

from apps.workspaces.models import Workspace


class TaskStatus(models.TextChoices):
    TODO = "todo", "To do"
    IN_PROGRESS = "in_progress", "In progress"
    REVIEW = "review", "Review"
    DONE = "done", "Done"


class TaskPriority(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class WorkspaceTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=12, choices=TaskStatus.choices, default=TaskStatus.TODO)
    priority = models.CharField(max_length=8, choices=TaskPriority.choices, default=TaskPriority.MEDIUM)
    position = models.FloatField(default=1.0)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_workspace_tasks",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_workspace_tasks",
    )
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "position", "created_at"]
        indexes = [
            models.Index(fields=["workspace", "status", "position"], name="task_ws_status_pos_idx"),
            models.Index(fields=["assignee", "status"], name="task_assignee_status_idx"),
        ]

    def __str__(self):
        return self.title
