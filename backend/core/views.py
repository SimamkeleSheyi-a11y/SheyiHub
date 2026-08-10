from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.shortcuts import render


def health(request):
    """Readiness probe with no implementation details in the response."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        cache.set("healthcheck", "ok", timeout=5)
        if cache.get("healthcheck") != "ok":
            raise RuntimeError("cache unavailable")
    except Exception:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


def spa_index(request):
    """Serve the production React shell; Vite handles client-side routing."""
    return render(request, "index.html")
