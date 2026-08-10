from django.utils import timezone
from rest_framework import serializers

from apps.notifications.models import NotificationKind
from apps.notifications.services import create_notification
from apps.users.models import User
from apps.users.serializers import UserProfileSerializer

from .models import InviteStatus, Meeting, MeetingInvite, MeetingStatus


class ParticipantSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(source="invited_user", read_only=True)

    class Meta:
        model = MeetingInvite
        fields = ["id", "user", "status"]


class MeetingListSerializer(serializers.ModelSerializer):
    host = UserProfileSerializer(read_only=True)
    my_invite_status = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            "id",
            "title",
            "host",
            "scheduled_start",
            "scheduled_end",
            "status",
            "room_slug",
            "waiting_room_enabled",
            "my_invite_status",
        ]

    def get_my_invite_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or obj.host_id == request.user.id:
            return None
        invites = list(obj.invites.all())
        invite = next((item for item in invites if item.invited_user_id == request.user.id), None)
        return invite.status if invite else None


class MeetingDetailSerializer(MeetingListSerializer):
    invited_emails = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()

    class Meta(MeetingListSerializer.Meta):
        fields = MeetingListSerializer.Meta.fields + [
            "actual_start",
            "actual_end",
            "created_at",
            "invited_emails",
            "participants",
        ]

    def get_invited_emails(self, obj):
        return [invite.invited_user.email for invite in obj.invites.all()]

    def get_participants(self, obj):
        invites = sorted(
            obj.invites.all(),
            key=lambda invite: (invite.invited_user.display_name.lower(), invite.invited_user.email.lower()),
        )
        return ParticipantSerializer(invites, many=True).data


class MeetingWriteSerializer(serializers.ModelSerializer):
    invitee_emails = serializers.ListField(
        child=serializers.EmailField(), write_only=True, required=False, default=list
    )

    class Meta:
        model = Meeting
        fields = [
            "id",
            "title",
            "scheduled_start",
            "scheduled_end",
            "waiting_room_enabled",
            "invitee_emails",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        start = attrs.get("scheduled_start", getattr(self.instance, "scheduled_start", None))
        end = attrs.get("scheduled_end", getattr(self.instance, "scheduled_end", None))
        if start and end and end <= start:
            raise serializers.ValidationError({"scheduled_end": "Must be after the start time."})
        if self.instance is None and start and start < timezone.now():
            raise serializers.ValidationError({"scheduled_start": "Can't schedule a meeting in the past."})
        return attrs

    def create(self, validated_data):
        invitee_emails = validated_data.pop("invitee_emails", [])
        meeting = Meeting.objects.create(host=self.context["request"].user, **validated_data)
        self._sync_invites(meeting, invitee_emails)
        return meeting

    def update(self, instance, validated_data):
        invitee_emails = validated_data.pop("invitee_emails", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if invitee_emails is not None:
            self._sync_invites(instance, invitee_emails)
        return instance

    @staticmethod
    def _sync_invites(meeting, emails):
        if not emails:
            return
        normalized = {email.lower().strip() for email in emails}
        users = User.objects.filter(email__in=normalized).exclude(id=meeting.host_id)
        existing = set(meeting.invites.values_list("invited_user_id", flat=True))
        new_users = [user for user in users if user.id not in existing]
        MeetingInvite.objects.bulk_create(
            [MeetingInvite(meeting=meeting, invited_user=user) for user in new_users]
        )
        for user in new_users:
            create_notification(
                user_id=user.id,
                actor_id=meeting.host_id,
                kind=NotificationKind.MEETING_INVITE,
                title=f"{meeting.host.display_name} invited you to a meeting",
                body=meeting.title,
                target_url=f"/meetings/{meeting.id}",
            )


class AddParticipantSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.lower().strip()
        meeting = self.context["meeting"]
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError("No SheyiHub user exists with this email.") from None
        if user.id == meeting.host_id:
            raise serializers.ValidationError("The organiser is already part of this meeting.")
        self.context["invited_user"] = user
        return email

    def save(self):
        meeting = self.context["meeting"]
        user = self.context["invited_user"]
        invite, created = MeetingInvite.objects.get_or_create(meeting=meeting, invited_user=user)
        should_notify = created
        if not created and invite.status == InviteStatus.DECLINED:
            invite.status = InviteStatus.PENDING
            invite.save(update_fields=["status"])
            should_notify = True
        if should_notify:
            create_notification(
                user_id=user.id,
                actor_id=meeting.host_id,
                kind=NotificationKind.MEETING_INVITE,
                title=f"{meeting.host.display_name} invited you to a meeting",
                body=meeting.title,
                target_url=f"/meetings/{meeting.id}",
            )
        return invite, created


class RespondToInviteSerializer(serializers.Serializer):
    response = serializers.ChoiceField(choices=["accept", "decline"])

    def save(self):
        invite = self.context["invite"]
        previous_status = invite.status
        invite.status = (
            InviteStatus.ACCEPTED if self.validated_data["response"] == "accept" else InviteStatus.DECLINED
        )
        invite.save(update_fields=["status"])
        if invite.status != previous_status:
            create_notification(
                user_id=invite.meeting.host_id,
                actor_id=invite.invited_user_id,
                kind=NotificationKind.MEETING_RESPONSE,
                title=f"{invite.invited_user.display_name} {invite.status} your invitation",
                body=invite.meeting.title,
                target_url=f"/meetings/{invite.meeting_id}",
            )
        return invite
