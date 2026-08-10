# Generated for SheyiHub Phase 11 product polish.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("users", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="bio",
            field=models.CharField(blank=True, default="", max_length=240),
        ),
    ]
