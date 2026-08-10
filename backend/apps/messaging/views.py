from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.http import FileResponse
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsEmailVerified
from apps.notifications.models import NotificationKind
from apps.notifications.services import create_notification

from .models import Conversation, SharedFile
from .permissions import IsConversationParticipant
from .serializers import (
    ConversationSerializer, MessageSerializer, SharedFileSerializer,
    SharedFileUploadSerializer, StartConversationSerializer,
)
from .services import get_or_create_message


class ConversationListCreateView(generics.ListCreateAPIView):
    def get_queryset(self):
        return Conversation.objects.filter(participants__user=self.request.user).distinct()

    def get_serializer_class(self):
        return StartConversationSerializer if self.request.method == "POST" else ConversationSerializer

    def get_permissions(self):
        base = [permissions.IsAuthenticated]
        if self.request.method == "POST":
            base.append(IsEmailVerified)
        return [p() for p in base]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation = serializer.save()
        return Response(
            ConversationSerializer(conversation, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        conversation = self._get_conversation()
        return conversation.messages.select_related("sender").order_by("-sent_at")

    def _get_conversation(self):
        conversation = generics.get_object_or_404(Conversation, pk=self.kwargs["conversation_id"])
        self.check_object_permissions(self.request, conversation)
        return conversation

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsConversationParticipant()]


def _broadcast_message(message, exclude_user_id):
    """Pushes a message that was created outside the WebSocket consumer (the
    REST fallback path) out to every other participant's live connection,
    after the DB write has actually committed — otherwise a recipient whose
    socket IS up would only ever see a REST-fallback send on their next
    manual refresh (Phase 5 hardening: REST fallback wasn't broadcasting)."""
    channel_layer = get_channel_layer()
    payload = MessageSerializer(message).data
    payload["id"] = str(payload["id"])
    payload["conversation"] = str(payload["conversation"])
    participant_ids = [
        str(pid) for pid in message.conversation.participants.values_list("user_id", flat=True)
    ]

    def _send():
        for uid in participant_ids:
            if uid == exclude_user_id:
                continue
            async_to_sync(channel_layer.group_send)(f"user_{uid}", {"type": "chat.message", **payload})
            create_notification(
                user_id=uid,
                actor_id=message.sender_id,
                kind=NotificationKind.MESSAGE,
                title=f"New message from {message.sender.display_name}",
                body=message.content[:180],
                target_url=f"/chats/{message.conversation_id}",
            )

    transaction.on_commit(_send)


class SendMessageView(APIView):
    """REST fallback for sending a message — the primary path is the
    WebSocket `chat-message` event (Phase 2 §6); this exists so a message
    can still be sent if the socket is briefly down."""

    def post(self, request, conversation_id):
        conversation = generics.get_object_or_404(Conversation, pk=conversation_id)
        self.check_object_permissions(request, conversation)

        content = (request.data.get("content") or "").strip()
        if not content:
            return Response({"detail": "Message can't be empty."}, status=400)

        client_message_id = request.data.get("client_message_id") or ""

        with transaction.atomic():
            message, created = get_or_create_message(
                conversation=conversation,
                sender_id=request.user.id,
                content=content,
                client_message_id=client_message_id,
            )
            participant = conversation.participants.get(user=request.user)
            participant.last_read_message = message
            participant.save(update_fields=["last_read_message"])
            if created:
                _broadcast_message(message, exclude_user_id=str(request.user.id))

        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsConversationParticipant()]


class ConversationFileListCreateView(generics.ListCreateAPIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticated, IsConversationParticipant]

    def _get_conversation(self):
        conversation = generics.get_object_or_404(Conversation, pk=self.kwargs["conversation_id"])
        self.check_object_permissions(self.request, conversation)
        return conversation

    def get_queryset(self):
        conversation = self._get_conversation()
        return conversation.shared_files.select_related("uploader").order_by("-uploaded_at")

    def get_serializer_class(self):
        return SharedFileUploadSerializer if self.request.method == "POST" else SharedFileSerializer

    def create(self, request, *args, **kwargs):
        conversation = self._get_conversation()
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "conversation": conversation},
        )
        serializer.is_valid(raise_exception=True)
        shared_file = serializer.save()
        payload = SharedFileSerializer(shared_file).data
        participant_ids = [str(uid) for uid in conversation.participants.values_list("user_id", flat=True)]

        def notify_participants():
            channel_layer = get_channel_layer()
            for user_id in participant_ids:
                async_to_sync(channel_layer.group_send)(
                    f"user_{user_id}",
                    {
                        "type": "file.shared",
                        "conversation_id": str(conversation.id),
                        "file": payload,
                    },
                )
                if user_id != str(request.user.id):
                    create_notification(
                        user_id=user_id,
                        actor_id=request.user.id,
                        kind=NotificationKind.FILE_SHARED,
                        title=f"{request.user.display_name} shared a file",
                        body=shared_file.filename,
                        target_url=(
                            f"/meetings/{conversation.meeting_id}"
                            if conversation.meeting_id
                            else f"/chats/{conversation.id}"
                        ),
                    )

        transaction.on_commit(notify_participants)
        return Response(payload, status=status.HTTP_201_CREATED)


class SharedFileDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, file_id):
        shared_file = generics.get_object_or_404(
            SharedFile.objects.select_related("conversation"), pk=file_id
        )
        if not shared_file.conversation.participants.filter(user=request.user).exists():
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        inline = request.query_params.get("inline") == "1" and (
            shared_file.content_type.startswith("image/") or shared_file.content_type == "application/pdf"
        )
        response = FileResponse(
            shared_file.file.open("rb"),
            as_attachment=not inline,
            filename=shared_file.filename,
            content_type=shared_file.content_type,
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response
