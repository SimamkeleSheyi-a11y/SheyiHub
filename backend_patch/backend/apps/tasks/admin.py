from django.contrib import admin

from .models import WorkspaceTask


@admin.register(WorkspaceTask)
class WorkspaceTaskAdmin(admin.ModelAdmin):
    list_display = ("title", "workspace", "status", "priority", "assignee", "due_date")
    list_filter = ("status", "priority")
    search_fields = ("title", "workspace__name", "assignee__email")
