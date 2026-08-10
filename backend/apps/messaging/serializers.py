from rest_framework import serializers

from apps.users.models import User
from apps.users.serializers import UserProfileSerializer

from .models import Conversation, ConversationType, Message, SharedFile


class MessageSerializer(serializers.ModelSerializer):
    sender = UserProfileSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "conversation", "sender", "content", "sent_at", "client_message_id"]
        read_only_fields = ["id", "sender", "sent_at"]


class ConversationSerializer(serializers.ModelSerializer):
    participants = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    read_states = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "type", "participants", "last_message", "unread_count", "read_states", "created_at"]

    def get_participants(self, obj):
        request_user_id = self.context["request"].user.id
        others = [
            p.user for p in obj.participants.select_related("user").all() if p.user_id != request_user_id
        ]
        return UserProfileSerializer(others, many=True).data

    def get_last_message(self, obj):
        last = obj.messages.order_by("-sent_at").first()
        return MessageSerializer(last).data if last else None

    def get_unread_count(self, obj):
        request_user_id = self.context["request"].user.id
        participant = next((p for p in obj.participants.all() if p.user_id == request_user_id), None)
        if participant is None:
            return 0
        qs = obj.messages.all()
        if participant.last_read_message_id:
            qs = qs.filter(sent_at__gt=participant.last_read_message.sent_at)
        return qs.exclude(sender_id=request_user_id).count()

    def get_read_states(self, obj):
        """{user_id: last_read_message_id} for every *other* participant —
        lets the frontend show "Read by N/M" correctly from the moment a
        conversation is opened, not only from read receipts that happen to
        arrive live while it's on screen (Phase 5 hardening: group read
        receipts)."""
        request_user_id = self.context["request"].user.id
        return {
            str(p.user_id): str(p.last_read_message_id)
            for p in obj.participants.all()
            if p.user_id != request_user_id and p.last_read_message_id
        }


class StartConversationSerializer(serializers.Serializer):
    participant_emails = serializers.ListField(child=serializers.EmailField(), min_length=1)

    def validate_participant_emails(self, emails):
        emails = [e.lower().strip() for e in emails]
        users = list(User.objects.filter(email__in=emails))
        if len(users) != len(set(emails)):
            raise serializers.ValidationError("One or more of those users don't exist.")
        return users

    def create(self, validated_data):
        request_user = self.context["request"].user
        other_users = validated_data["participant_emails"]
        conv_type = ConversationType.DM if len(other_users) == 1 else ConversationType.GROUP

        # Reuse an existing 1:1 DM instead of creating a duplicate.
        if conv_type == ConversationType.DM:
            existing = (
                Conversation.objects.filter(type=ConversationType.DM, participants__user=request_user)
                .filter(participants__user=other_users[0])
                .first()
            )
            if existing:
                return existing

        conversation = Conversation.objects.create(type=conv_type)
        conversation.participants.bulk_create(
            [
                conversation.participants.model(conversation=conversation, user=u)
                for u in [request_user, *other_users]
            ]
        )
        return conversation


class SharedFileSerializer(serializers.ModelSerializer):
    uploader = UserProfileSerializer(read_only=True)
    previewable = serializers.SerializerMethodField()

    class Meta:
        model = SharedFile
        fields = [
            "id", "conversation", "uploader", "filename", "content_type",
            "size_bytes", "uploaded_at", "previewable",
        ]
        read_only_fields = fields

    def get_previewable(self, obj):
        return obj.content_type.startswith("image/") or obj.content_type == "application/pdf"


class SharedFileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    MAX_FILE_SIZE = 25 * 1024 * 1024
    ALLOWED_CONTENT_TYPES = {
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf", "text/plain", "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
    ALLOWED_EXTENSIONS = {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".txt", ".csv",
        ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    }

    @staticmethod
    def _reset(uploaded):
        try:
            uploaded.seek(0)
        except (AttributeError, OSError):
            pass

    def _validate_signature(self, uploaded, extension):
        """Reject common extension/MIME spoofing before a file reaches storage.

        This is intentionally conservative rather than pretending to be an
        antivirus scanner. It verifies the formats SheyiHub can identify
        reliably and keeps every stored file behind authenticated download
        endpoints with ``nosniff`` enabled.
        """
        import zipfile

        from PIL import Image, UnidentifiedImageError

        self._reset(uploaded)
        head = uploaded.read(8192)
        self._reset(uploaded)

        if extension in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
            try:
                image = Image.open(uploaded)
                image.verify()
            except (UnidentifiedImageError, OSError, ValueError):
                raise serializers.ValidationError("The image contents don't match a supported image format.")
            finally:
                self._reset(uploaded)
            return

        if extension == ".pdf":
            if not head.startswith(b"%PDF-"):
                raise serializers.ValidationError("The file contents don't match a PDF document.")
            return

        if extension in {".docx", ".xlsx", ".pptx"}:
            expected_root = {".docx": "word/", ".xlsx": "xl/", ".pptx": "ppt/"}[extension]
            try:
                with zipfile.ZipFile(uploaded) as archive:
                    names = archive.namelist()
                    valid = "[Content_Types].xml" in names and any(name.startswith(expected_root) for name in names)
            except (zipfile.BadZipFile, OSError):
                valid = False
            finally:
                self._reset(uploaded)
            if not valid:
                raise serializers.ValidationError("The file contents don't match that Office document type.")
            return

        if extension in {".doc", ".xls", ".ppt"}:
            if not head.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
                raise serializers.ValidationError("The file contents don't match a legacy Office document.")
            return

        if extension in {".txt", ".csv"} and b"\x00" in head:
            raise serializers.ValidationError("Text and CSV files can't contain binary null bytes.")

    def validate_file(self, uploaded):
        from pathlib import Path

        if uploaded.size > self.MAX_FILE_SIZE:
            raise serializers.ValidationError("Files must be 25 MB or smaller.")
        clean_name = Path(uploaded.name).name.strip()
        if not clean_name:
            raise serializers.ValidationError("A filename is required.")
        content_type = (getattr(uploaded, "content_type", "") or "").lower()
        extension = Path(clean_name).suffix.lower()
        if content_type not in self.ALLOWED_CONTENT_TYPES or extension not in self.ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                "That file type isn't supported. Use an image, PDF, text/CSV, Word, Excel, or PowerPoint file."
            )

        self._validate_signature(uploaded, extension)
        uploaded.name = clean_name[:255]
        return uploaded

    def create(self, validated_data):
        uploaded = validated_data["file"]
        return SharedFile.objects.create(
            conversation=self.context["conversation"],
            uploader=self.context["request"].user,
            file=uploaded,
            filename=uploaded.name,
            content_type=(getattr(uploaded, "content_type", "") or "application/octet-stream").lower(),
            size_bytes=uploaded.size,
        )

