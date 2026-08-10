import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0002_message_client_message_id_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SharedFile",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("file", models.FileField(upload_to="shared_files/%Y/%m/%d")),
                ("filename", models.CharField(max_length=255)),
                ("content_type", models.CharField(max_length=127)),
                ("size_bytes", models.PositiveBigIntegerField()),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                (
                    "conversation",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="shared_files",
                        to="messaging.conversation",
                    ),
                ),
                (
                    "uploader",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="shared_files",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-uploaded_at"]},
        ),
        migrations.AddIndex(
            model_name="sharedfile",
            index=models.Index(fields=["conversation", "-uploaded_at"], name="messaging_s_convers_4b4836_idx"),
        ),
    ]
