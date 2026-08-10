import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient

from apps.meetings.models import MeetingStatus
from apps.meetings.tests.factories import MeetingFactory
from apps.messaging.models import Conversation, ConversationParticipant, ConversationType, SharedFile
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def make_conversation(*users, conversation_type=ConversationType.DM, meeting=None):
    conversation = Conversation.objects.create(type=conversation_type, meeting=meeting)
    for user in users:
        ConversationParticipant.objects.create(conversation=conversation, user=user)
    return conversation


def test_participant_can_upload_and_list_a_file(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    me, other = UserFactory(), UserFactory()
    conversation = make_conversation(me, other)
    upload = SimpleUploadedFile("notes.txt", b"hello team", content_type="text/plain")

    response = auth_client(me).post(
        reverse("conversation-files", args=[conversation.id]), {"file": upload}, format="multipart"
    )
    assert response.status_code == 201
    assert response.data["filename"] == "notes.txt"

    listed = auth_client(other).get(reverse("conversation-files", args=[conversation.id]))
    rows = listed.data.get("results", listed.data)
    assert listed.status_code == 200
    assert rows[0]["filename"] == "notes.txt"


def test_non_participant_cannot_list_or_upload_files(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    member, stranger = UserFactory(), UserFactory()
    conversation = make_conversation(member)
    assert auth_client(stranger).get(reverse("conversation-files", args=[conversation.id])).status_code in (403, 404)
    response = auth_client(stranger).post(
        reverse("conversation-files", args=[conversation.id]),
        {"file": SimpleUploadedFile("notes.txt", b"nope", content_type="text/plain")},
        format="multipart",
    )
    assert response.status_code in (403, 404)
    assert SharedFile.objects.count() == 0


def test_file_type_allow_list_is_enforced(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    me = UserFactory()
    conversation = make_conversation(me)
    response = auth_client(me).post(
        reverse("conversation-files", args=[conversation.id]),
        {"file": SimpleUploadedFile("danger.exe", b"MZ", content_type="application/x-msdownload")},
        format="multipart",
    )
    assert response.status_code == 400
    assert SharedFile.objects.count() == 0


def test_max_file_size_is_enforced(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    me = UserFactory()
    conversation = make_conversation(me)
    response = auth_client(me).post(
        reverse("conversation-files", args=[conversation.id]),
        {"file": SimpleUploadedFile("large.txt", b"x" * (25 * 1024 * 1024 + 1), content_type="text/plain")},
        format="multipart",
    )
    assert response.status_code == 400


def test_participant_can_download_but_stranger_gets_404(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    me, other, stranger = UserFactory(), UserFactory(), UserFactory()
    conversation = make_conversation(me, other)
    shared = SharedFile.objects.create(
        conversation=conversation, uploader=me,
        file=SimpleUploadedFile("agenda.pdf", b"pdf-bytes", content_type="application/pdf"),
        filename="agenda.pdf", content_type="application/pdf", size_bytes=9,
    )
    allowed = auth_client(other).get(reverse("file-download", args=[shared.id]))
    denied = auth_client(stranger).get(reverse("file-download", args=[shared.id]))
    assert allowed.status_code == 200
    assert b"".join(allowed.streaming_content) == b"pdf-bytes"
    assert denied.status_code == 404


def test_meeting_files_remain_available_after_meeting_ends(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    host, invitee = UserFactory(email_verified=True), UserFactory(email_verified=True)
    meeting = MeetingFactory(host=host, status=MeetingStatus.LIVE)
    meeting.invites.create(invited_user=invitee, status="accepted")
    conversation = make_conversation(host, invitee, conversation_type=ConversationType.MEETING, meeting=meeting)
    SharedFile.objects.create(
        conversation=conversation, uploader=host,
        file=SimpleUploadedFile("summary.txt", b"done", content_type="text/plain"),
        filename="summary.txt", content_type="text/plain", size_bytes=4,
    )
    assert auth_client(host).post(reverse("meeting-end", args=[meeting.id])).status_code == 200
    response = auth_client(invitee).get(reverse("conversation-files", args=[conversation.id]))
    rows = response.data.get("results", response.data)
    assert response.status_code == 200
    assert rows[0]["filename"] == "summary.txt"


def test_spoofed_pdf_signature_is_rejected(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    me = UserFactory()
    conversation = make_conversation(me)
    response = auth_client(me).post(
        reverse("conversation-files", args=[conversation.id]),
        {"file": SimpleUploadedFile("fake.pdf", b"not really a pdf", content_type="application/pdf")},
        format="multipart",
    )
    assert response.status_code == 400
    assert SharedFile.objects.count() == 0


def test_uploaded_file_is_stored_under_randomized_name(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    me = UserFactory()
    conversation = make_conversation(me)
    response = auth_client(me).post(
        reverse("conversation-files", args=[conversation.id]),
        {"file": SimpleUploadedFile("private-notes.txt", b"hello team", content_type="text/plain")},
        format="multipart",
    )
    assert response.status_code == 201
    shared = SharedFile.objects.get(pk=response.data["id"])
    assert shared.filename == "private-notes.txt"
    assert shared.file.name.startswith("shared_files/")
    assert "private-notes" not in shared.file.name
