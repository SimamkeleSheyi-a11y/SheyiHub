# Generated for SheyiHub Phase 9 collaborative whiteboard.
import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("meetings", "0002_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MeetingWhiteboardStroke",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("tool", models.CharField(choices=[("draw", "Draw"), ("erase", "Erase")], default="draw", max_length=5)),
                ("color", models.CharField(default="#111827", max_length=7)),
                ("width", models.PositiveSmallIntegerField(default=4)),
                ("points", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="meeting_whiteboard_strokes", to=settings.AUTH_USER_MODEL)),
                ("meeting", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="whiteboard_strokes", to="meetings.meeting")),
            ],
            options={"ordering": ["created_at", "id"]},
        ),
        migrations.AddIndex(
            model_name="meetingwhiteboardstroke",
            index=models.Index(fields=["meeting", "created_at"], name="meetings_me_meeting_0f637d_idx"),
        ),
    ]
