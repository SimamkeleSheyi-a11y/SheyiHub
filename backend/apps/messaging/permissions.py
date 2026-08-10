from rest_framework.permissions import BasePermission


class IsConversationParticipant(BasePermission):
    message = "You're not part of this conversation."

    def has_object_permission(self, request, view, obj):
        conversation = obj if hasattr(obj, "participants") else obj.conversation
        return conversation.participants.filter(user_id=request.user.id).exists()
