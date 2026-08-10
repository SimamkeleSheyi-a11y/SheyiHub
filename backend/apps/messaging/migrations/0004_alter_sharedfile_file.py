# Generated for Phase 12 production hardening.

from django.db import migrations, models

import apps.messaging.models


class Migration(migrations.Migration):
    dependencies = [("messaging", "0003_sharedfile")]

    operations = [
        migrations.AlterField(
            model_name="sharedfile",
            name="file",
            field=models.FileField(upload_to=apps.messaging.models.shared_file_upload_to),
        ),
    ]
