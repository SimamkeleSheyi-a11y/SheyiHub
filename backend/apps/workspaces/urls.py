from django.urls import path

from .views import WorkspaceDetailView, WorkspaceListCreateView, WorkspaceMemberDetailView, WorkspaceMembersView

urlpatterns = [
    path("", WorkspaceListCreateView.as_view(), name="workspace-list-create"),
    path("<uuid:pk>/", WorkspaceDetailView.as_view(), name="workspace-detail"),
    path("<uuid:workspace_id>/members/", WorkspaceMembersView.as_view(), name="workspace-members"),
    path("<uuid:workspace_id>/members/<uuid:member_id>/", WorkspaceMemberDetailView.as_view(), name="workspace-member-detail"),
]
