from django.urls import path

from . import views

urlpatterns = [
    path("", views.ConversationListCreateView.as_view(), name="conversation-list"),
    path("<uuid:conversation_id>/messages", views.MessageListView.as_view(), name="conversation-messages"),
    path("<uuid:conversation_id>/messages/send", views.SendMessageView.as_view(), name="conversation-send"),
    path("<uuid:conversation_id>/files", views.ConversationFileListCreateView.as_view(), name="conversation-files"),
]
