from django.urls import path

from .views import WorkspaceTaskDetailView, WorkspaceTaskListCreateView

urlpatterns = [
    path("", WorkspaceTaskListCreateView.as_view(), name="task-list-create"),
    path("<uuid:pk>/", WorkspaceTaskDetailView.as_view(), name="task-detail"),
]
