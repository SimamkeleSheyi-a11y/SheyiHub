from django.urls import path

from .views import SharedFileDownloadView

urlpatterns = [
    path("<uuid:file_id>/download", SharedFileDownloadView.as_view(), name="file-download"),
]
