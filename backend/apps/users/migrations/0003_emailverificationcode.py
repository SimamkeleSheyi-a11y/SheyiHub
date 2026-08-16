# Generated for SheyiHub 1.0 email verification codes.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_user_bio"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailVerificationCode",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "code_hash",
                    models.CharField(blank=True, default="", max_length=128),
                ),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="email_verification_code",
                        to="users.user",
                    ),
                ),
            ],
        ),
    ]
