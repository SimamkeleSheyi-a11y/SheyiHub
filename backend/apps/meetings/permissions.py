from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsMeetingHost(BasePermission):
    """Edit/cancel a meeting and manage invitees: organiser only."""

    message = "Only the organiser can do this."

    def has_object_permission(self, request, view, obj):
        return obj.host_id == request.user.id


class IsMeetingParticipantOrHost(BasePermission):
    """Read a meeting: organiser or an invited/admitted participant."""

    message = "You don't have access to this meeting."

    def has_object_permission(self, request, view, obj):
        if request.method not in SAFE_METHODS:
            return obj.host_id == request.user.id
        if obj.host_id == request.user.id:
            return True
        return (
            obj.participants.filter(user_id=request.user.id).exists()
            or obj.invites.filter(invited_user_id=request.user.id).exists()
        )
