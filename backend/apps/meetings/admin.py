from django.contrib import admin

from .models import Meeting, MeetingInvite, MeetingParticipant, MeetingWhiteboardStroke


class MeetingParticipantInline(admin.TabularInline):
    model = MeetingParticipant
    extra = 0
    readonly_fields = ("id", "joined_at", "left_at")


class MeetingInviteInline(admin.TabularInline):
    model = MeetingInvite
    extra = 0
    readonly_fields = ("id",)


@admin.register(Meeting)
class MeetingAdmin(admin.ModelAdmin):
    list_display = ("title", "host", "status", "scheduled_start", "waiting_room_enabled", "room_slug")
    list_filter = ("status", "waiting_room_enabled")
    search_fields = ("title", "room_slug", "host__email", "host__display_name")
    ordering = ("-scheduled_start",)
    readonly_fields = ("id", "room_slug", "created_at")
    inlines = [MeetingParticipantInline, MeetingInviteInline]


@admin.register(MeetingParticipant)
class MeetingParticipantAdmin(admin.ModelAdmin):
    list_display = ("meeting", "user", "role", "status", "joined_at", "left_at")
    list_filter = ("role", "status")
    search_fields = ("meeting__title", "user__email")
    readonly_fields = ("id",)


@admin.register(MeetingInvite)
class MeetingInviteAdmin(admin.ModelAdmin):
    list_display = ("meeting", "invited_user", "status")
    list_filter = ("status",)
    search_fields = ("meeting__title", "invited_user__email")
    readonly_fields = ("id",)


@admin.register(MeetingWhiteboardStroke)
class MeetingWhiteboardStrokeAdmin(admin.ModelAdmin):
    list_display = ("meeting", "author", "tool", "width", "created_at")
    list_filter = ("tool", "created_at")
    search_fields = ("meeting__title", "author__email", "author__display_name")
    readonly_fields = ("id", "meeting", "author", "tool", "color", "width", "points", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
