from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import RedirectView

from core.views import health, spa_index
from core.search_views import GlobalSearchView

urlpatterns = [
    path("favicon.svg", RedirectView.as_view(url="/static/favicon.svg", permanent=False)),
    path("api/health", health, name="health"),
    path("api/search/", GlobalSearchView.as_view(), name="global-search"),
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls_auth")),
    path("api/users/", include("apps.users.urls_users")),
    path("api/meetings/", include("apps.meetings.urls")),
    path("api/conversations/", include("apps.messaging.urls")),
    path("api/files/", include("apps.messaging.files_urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/workspaces/", include("apps.workspaces.urls")),
    path("api/tasks/", include("apps.tasks.urls")),
]

# In the single-origin production image, Django serves the React shell while
# WhiteNoise serves hashed assets under /static/. Local dev still uses Vite.
if not settings.DEBUG and getattr(settings, "FRONTEND_DIST_DIR", None) and settings.FRONTEND_DIST_DIR.exists():
    urlpatterns += [re_path(r"^(?!api/|admin/|static/).*$", spa_index, name="spa-index")]
