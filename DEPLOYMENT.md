# Production deployment

SheyiHub's recommended production shape is **single-origin**: the root `Dockerfile` builds the React app, Django serves the SPA shell, WhiteNoise serves hashed static assets, and the same ASGI service handles `/api/*` plus `/ws/*`. This keeps refresh cookies and WebSocket routing simple and avoids cross-origin auth edge cases.

## Required services

1. **Web service** — root `Dockerfile`, ASGI/Gunicorn + Uvicorn worker.
2. **PostgreSQL** — application data.
3. **Redis-compatible service** — Channels, cache, WebSocket tickets, presence/typing state, and Celery broker/results.
4. **Celery worker** — email verification and password-reset email jobs.
5. **Durable media storage** — mount to `/app/media` or replace Django filesystem storage with object storage before scaling horizontally.
6. **SMTP** — verification and password reset email.
7. **TURN** — strongly recommended before claiming reliable calls across arbitrary networks.

## Environment variables

Start from `backend/.env.production.example`. At minimum set:

```text
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY=<strong random secret>
DJANGO_ALLOWED_HOSTS=<public hostname>
FRONTEND_URL=https://<public hostname>
DATABASE_URL=<postgres URL>
REDIS_URL=<redis URL>
EMAIL_HOST=<smtp host>
EMAIL_PORT=587
EMAIL_HOST_USER=<smtp username>
EMAIL_HOST_PASSWORD=<smtp password>
DEFAULT_FROM_EMAIL=<sender address>
MEDIA_ROOT=/app/media
```

For the recommended single-origin image, leave `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` blank.

## Build and start

The root image already runs:

```text
npm ci
npm run build
pip install -r requirements/production.txt
python manage.py collectstatic --noinput
```

Run database migrations as a **pre-deploy/release command**:

```bash
python manage.py migrate --noinput
```

The web process is already defined in the Dockerfile:

```bash
gunicorn config.asgi:application \
  -k uvicorn_worker.UvicornWorker \
  --bind 0.0.0.0:$PORT \
  --workers 2
```

The worker process is:

```bash
celery -A config worker -l info
```

## Preflight

With production environment variables available:

```bash
python manage.py check --deploy --settings=config.settings.production
```

Then verify:

```text
GET https://<host>/api/health
→ 200 {"status":"ok"}
```

The health probe checks both PostgreSQL and Redis/cache readiness without returning implementation details.

For a brand-new hostname, keep the initial HSTS window short (`SECURE_HSTS_SECONDS=3600`). After HTTPS and any subdomains are confirmed, increase it deliberately; only enable HSTS subdomain/preload options if every affected hostname is HTTPS-ready.

## Render example workflow

SheyiHub can be deployed as a Docker web service on Render:

1. Push the repository to GitHub.
2. Create PostgreSQL and a Redis-compatible Key Value instance.
3. Create a Docker Web Service from the repo root and add the production environment variables.
4. Set the pre-deploy command to `python manage.py migrate --noinput`.
5. Set the health-check path to `/api/health`.
6. Add a background worker using the same repository/image and the Celery command above.
7. If using local media storage, attach durable storage at `/app/media`. If you plan to scale to multiple web instances, use object storage instead.
8. Configure SMTP.
9. Open the deployed app and perform the full release checklist in `RELEASE_CHECKLIST.md`.

## WebRTC note

STUN is enough for many development/demo networks but not every real-world NAT/firewall combination. TURN credentials are client-consumable by design, but long-lived shared TURN secrets must **not** be compiled into `VITE_*` variables. For a serious public deployment, use time-limited TURN credentials and test from two devices on different networks.

## Rollback

Before production migrations:

- take a PostgreSQL backup/snapshot;
- keep the previous deploy available;
- do not delete old migration files;
- preserve uploaded media independently of the application image.
