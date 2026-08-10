from django.contrib import admin

from .models import Conversation, ConversationParticipant, Message, MessageReaction


class ConversationParticipantInline(admin.TabularInline):
    model = ConversationParticipant
    extra = 0
    readonly_fields = ("id",)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "meeting", "created_at")
    list_filter = ("type",)
    search_fields = ("id", "meeting__title")
    ordering = ("-created_at",)
    readonly_fields = ("id", "created_at")
    inlines = [ConversationParticipantInline]


@admin.register(ConversationParticipant)
class ConversationParticipantAdmin(admin.ModelAdmin):
    list_display = ("conversation", "user", "last_read_message")
    search_fields = ("conversation__id", "user__email")
    readonly_fields = ("id",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "short_content", "sent_at")
    list_filter = ("sent_at",)
    search_fields = ("content", "sender__email", "conversation__id")
    ordering = ("-sent_at",)
    readonly_fields = ("id", "sent_at", "client_message_id")

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:60] + ("…" if len(obj.content) > 60 else "")


@admin.register(MessageReaction)
class MessageReactionAdmin(admin.ModelAdmin):
    list_display = ("message", "user", "emoji")
    search_fields = ("user__email",)
    readonly_fields = ("id",)
