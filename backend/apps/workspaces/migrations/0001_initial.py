import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="Workspace",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(editable=False, max_length=150, unique=True)),
                ("description", models.CharField(blank=True, default="", max_length=280)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="owned_workspaces", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at", "name"]},
        ),
        migrations.CreateModel(
            name="WorkspaceMember",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("role", models.CharField(choices=[("owner", "Owner"), ("admin", "Admin"), ("member", "Member")], default="member", max_length=10)),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="workspace_memberships", to=settings.AUTH_USER_MODEL)),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="workspaces.workspace")),
            ],
            options={"ordering": ["joined_at"], "unique_together": {("workspace", "user")}},
        ),
        migrations.AddIndex(model_name="workspacemember", index=models.Index(fields=["user", "workspace"], name="ws_member_user_ws_idx")),
    ]
