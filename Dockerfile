# Production single-origin image: React assets + Django/Channels in one service.
FROM node:22-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_BASE_URL=/api
ENV VITE_WS_BASE_URL=
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production \
    MEDIA_ROOT=/app/media

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/production.txt

COPY backend/ ./
COPY --from=frontend-build /frontend/dist ./frontend_dist

# collectstatic doesn't need the real production database/cache; build-only
# values keep secrets out of image layers while still exercising settings.
RUN DJANGO_SECRET_KEY=build-only-secret-key-00000000000000000000 \
    DJANGO_ALLOWED_HOSTS=localhost \
    DATABASE_URL=sqlite:////tmp/sheyihub-build.sqlite3 \
    REDIS_URL=redis://localhost:6379/0 \
    EMAIL_HOST=localhost \
    FRONTEND_URL=https://localhost \
    python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.asgi:application -k uvicorn_worker.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --workers 1 --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -"]
