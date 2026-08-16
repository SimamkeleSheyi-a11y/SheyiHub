import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("workspaces", "0001_initial"),
    ]
    operations = [
        migrations.CreateModel(
            name="WorkspaceTask",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=180)),
                ("description", models.TextField(blank=True, default="")),
                ("status", models.CharField(choices=[("todo", "To do"), ("in_progress", "In progress"), ("review", "Review"), ("done", "Done")], default="todo", max_length=12)),
                ("priority", models.CharField(choices=[("low", "Low"), ("medium", "Medium"), ("high", "High"), ("urgent", "Urgent")], default="medium", max_length=8)),
                ("position", models.FloatField(default=1.0)),
                ("due_date", models.DateField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assignee", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_workspace_tasks", to=settings.AUTH_USER_MODEL)),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_workspace_tasks", to=settings.AUTH_USER_MODEL)),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tasks", to="workspaces.workspace")),
            ],
            options={"ordering": ["status", "position", "created_at"]},
        ),
        migrations.AddIndex(model_name="workspacetask", index=models.Index(fields=["workspace", "status", "position"], name="task_ws_status_pos_idx")),
        migrations.AddIndex(model_name="workspacetask", index=models.Index(fields=["assignee", "status"], name="task_assignee_status_idx")),
    ]
