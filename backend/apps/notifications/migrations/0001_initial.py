# Generated for SheyiHub Phase 10 notifications.
import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="NotificationPreference",
            fields=[
                ("user", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, related_name="notification_preferences", serialize=False, to=settings.AUTH_USER_MODEL)),
                ("messages_enabled", models.BooleanField(default=True)),
                ("meetings_enabled", models.BooleanField(default=True)),
                ("files_enabled", models.BooleanField(default=True)),
                ("browser_enabled", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("kind", models.CharField(choices=[("message", "Message"), ("meeting_invite", "Meeting invite"), ("meeting_response", "Meeting response"), ("meeting_started", "Meeting started"), ("file_shared", "File shared")], max_length=32)),
                ("title", models.CharField(max_length=160)),
                ("body", models.CharField(blank=True, default="", max_length=400)),
                ("target_url", models.CharField(blank=True, default="", max_length=300)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications_created", to=settings.AUTH_USER_MODEL)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["user", "created_at"], name="notif_user_created_idx"),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["user", "read_at"], name="notif_user_read_idx"),
        ),
    ]
