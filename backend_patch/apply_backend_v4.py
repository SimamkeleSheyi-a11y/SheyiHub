from pathlib import Path
import shutil
import sys

HERE = Path(__file__).resolve().parent
project_root = Path.cwd()
backend = project_root / "backend"
if not backend.exists():
    raise SystemExit("Run this script from the SheyiHub project root (the folder containing backend/ and frontend/).")

for app in ["workspaces", "tasks"]:
    src = HERE / "backend" / "apps" / app
    dst = backend / "apps" / app
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    print(f"Installed backend/apps/{app}")


search_src = HERE / "backend" / "core" / "search_views.py"
search_dst = backend / "core" / "search_views.py"
shutil.copy2(search_src, search_dst)
print("Installed global search endpoint implementation")

base = backend / "config" / "settings" / "base.py"
text = base.read_text(encoding="utf-8")
anchor = '    "apps.realtime",\n'
addition = '    "apps.workspaces",\n    "apps.tasks",\n'
if '"apps.workspaces"' not in text:
    if anchor not in text:
        raise SystemExit("Could not safely locate apps.realtime in backend/config/settings/base.py")
    text = text.replace(anchor, anchor + addition, 1)
    base.write_text(text, encoding="utf-8")
    print("Registered workspaces/tasks in INSTALLED_APPS")

urls = backend / "config" / "urls.py"
text = urls.read_text(encoding="utf-8")
anchor = '    path("api/notifications/", include("apps.notifications.urls")),\n'
addition = '    path("api/workspaces/", include("apps.workspaces.urls")),\n    path("api/tasks/", include("apps.tasks.urls")),\n'
if 'apps.workspaces.urls' not in text:
    if anchor not in text:
        raise SystemExit("Could not safely locate notifications URL in backend/config/urls.py")
    text = text.replace(anchor, anchor + addition, 1)
    urls.write_text(text, encoding="utf-8")
    print("Registered /api/workspaces and /api/tasks")

search_anchor = '    path("api/health", health, name="health"),\n'
search_line = '    path("api/search/", GlobalSearchView.as_view(), name="global-search"),\n'
if 'from core.search_views import GlobalSearchView' not in text:
    import_anchor = 'from core.views import health, spa_index\n'
    if import_anchor not in text:
        raise SystemExit("Could not safely locate core.views import in backend/config/urls.py")
    text = text.replace(import_anchor, import_anchor + 'from core.search_views import GlobalSearchView\n', 1)
if 'name="global-search"' not in text:
    if search_anchor not in text:
        raise SystemExit("Could not safely locate health URL in backend/config/urls.py")
    text = text.replace(search_anchor, search_anchor + search_line, 1)
    print("Registered /api/search")
urls.write_text(text, encoding="utf-8")

# redis-py 8 uses a 5s default socket read timeout. channels_redis keeps long-lived
# blocking receives, so make the channel-layer read timeout explicit and comfortably
# longer while retaining a short connect timeout and TCP keepalive.
prod = backend / "config" / "settings" / "production.py"
text = prod.read_text(encoding="utf-8")
old = '            "hosts": [REDIS_URL],\n            "capacity": 1500,\n'
new = '            "hosts": [{\n                "address": REDIS_URL,\n                "socket_timeout": 30,\n                "socket_connect_timeout": 5,\n                "socket_keepalive": True,\n                "health_check_interval": 30,\n            }],\n            "capacity": 1500,\n'
if old in text and '"socket_timeout": 30' not in text:
    text = text.replace(old, new, 1)
    prod.write_text(text, encoding="utf-8")
    print("Hardened production Channels/Redis connection timeouts")
elif '"socket_timeout": 30' in text:
    print("Redis hardening already present")
else:
    print("WARNING: production.py Redis block had changed; no automatic Redis edit was made. Review BACKEND_PATCH_NOTES.md.")

print("\nBackend V4 patch applied. Next run:")
print("  cd backend")
print("  python manage.py makemigrations --check --dry-run")
print("  python manage.py migrate")
print("  python manage.py check")
