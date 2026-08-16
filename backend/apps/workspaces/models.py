import uuid

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class WorkspaceRole(models.TextChoices):
    OWNER = "owner", "Owner"
    ADMIN = "admin", "Admin"
    MEMBER = "member", "Member"


class Workspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=150, unique=True, editable=False)
    description = models.CharField(max_length=280, blank=True, default="")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_workspaces",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            stem = slugify(self.name)[:110] or "workspace"
            candidate = stem
            counter = 2
            while Workspace.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{stem}-{counter}"
                counter += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class WorkspaceMember(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workspace_memberships",
    )
    role = models.CharField(max_length=10, choices=WorkspaceRole.choices, default=WorkspaceRole.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("workspace", "user")]
        ordering = ["joined_at"]
        indexes = [models.Index(fields=["user", "workspace"], name="ws_member_user_ws_idx")]

    def __str__(self):
        return f"{self.user_id} in {self.workspace_id} ({self.role})"
