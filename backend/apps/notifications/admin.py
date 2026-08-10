from django.contrib import admin

from .models import Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("kind", "user", "title", "read_at", "created_at")
    list_filter = ("kind", "read_at")
    search_fields = ("user__email", "title", "body")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ("user", "messages_enabled", "meetings_enabled", "files_enabled", "browser_enabled")
