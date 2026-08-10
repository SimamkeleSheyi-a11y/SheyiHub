# SheyiHub

SheyiHub is a full-stack real-time communication and collaboration platform built with React, TypeScript, Django REST Framework, Django Channels and WebRTC.

It combines messaging, presence, meetings, file sharing, whiteboarding and notifications in one collaboration workspace while keeping authentication and authorization enforced server-side.

## Core features

- Email registration, verification, login, refresh-token rotation, logout and password reset
- Editable profile, bio, avatar and light/dark/system appearance preference
- Direct and group messaging
- Realtime messages, typing indicators, presence and read receipts
- Scheduled meetings, invitations, RSVP, waiting room and host controls
- WebRTC camera/microphone calling and screen sharing
- Meeting timer and persisted final duration
- Shared meeting chat
- File sharing in chats and meetings with preview/download and persistence
- Collaborative realtime whiteboard with pen, eraser, undo, host clear and persistence
- Persistent realtime notifications with per-category preferences and optional browser alerts
- Responsive desktop/mobile UI

## Stack

### Frontend

React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, Zustand and Lucide.

### Backend

Django 6, Django REST Framework, SimpleJWT, Django Channels, Redis, PostgreSQL, Celery and Pillow.

### Production

ASGI via Gunicorn + `uvicorn-worker`, WhiteNoise static serving, PostgreSQL, Redis-backed Channels/cache, optional Sentry, SMTP and durable upload storage.

## Architecture

```text
Browser
  ├─ HTTPS /api/* ───────────────┐
  ├─ WSS /ws/connect/ ───────────┤
  └─ WebRTC media peer-to-peer   │
                                 ▼
                     Django ASGI application
                     ├─ DRF API
                     ├─ Channels consumer
                     ├─ auth / permissions
                     ├─ meeting signaling
                     └─ React SPA shell + static assets
                         │
             ┌───────────┼────────────┐
             ▼           ▼            ▼
         PostgreSQL    Redis        Celery
```

Media does not pass through Django during a WebRTC call. Django validates participants and relays signaling only.

## Local setup — Windows / PowerShell

### Backend

```powershell
cd backend
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
pip install -r requirements\development.txt
$env:DJANGO_SETTINGS_MODULE="config.settings.development"
python manage.py migrate
python -m daphne -b 127.0.0.1 -p 8000 config.asgi:application
```

Development uses SQLite, in-memory Channels/cache and console email, so Redis/PostgreSQL are not required for this path.

### Frontend

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

Vite proxies `/api` and `/ws` to the local backend.

## Docker development

Docker Compose exercises PostgreSQL + Redis rather than the simplified SQLite/in-memory local settings:

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Health: `http://localhost:8000/api/health`

## Verification

Backend:

```powershell
$env:DJANGO_SETTINGS_MODULE="config.settings.development"
python manage.py migrate
python manage.py check
python manage.py makemigrations --check --dry-run
python -m pytest -v
```

Frontend:

```powershell
npm ci
npm run build
npm run lint
npm run test
```

Then perform the manual checklist in `RELEASE_CHECKLIST.md` with two accounts. A true two-way camera/microphone test should use two physical devices when available.

## Security design

- Access JWTs stay in memory rather than browser persistent storage.
- Refresh JWTs use `HttpOnly` cookies, rotation and blacklist support.
- Refresh requests use double-submit CSRF protection.
- WebSockets use short-lived, single-use auth tickets instead of JWT query strings, and production handshakes are origin-checked.
- Server-side membership/host checks protect meetings, conversations, files and whiteboards.
- Production requires Redis-backed Channels rather than the in-memory layer.
- Production enables HTTPS redirect, secure cookies, HSTS, CSP and browser security headers.
- Shared files use an allow-list, size limit, basic content-signature checks, randomized storage names and authenticated downloads.

See `SECURITY.md` for details.

## Production deployment

The repository now includes a root production `Dockerfile` that builds the React frontend and Django backend into one same-origin ASGI service. This avoids splitting authentication cookies and WebSockets across unrelated origins.

See `DEPLOYMENT.md` before deploying. Production additionally requires PostgreSQL, Redis, SMTP, durable media storage and a Celery worker. TURN should be added/tested before claiming reliable WebRTC connectivity across arbitrary networks.

## Environment files

- `backend/.env.example` — local development
- `backend/.env.production.example` — production template
- `frontend/.env.example` — public frontend/WebRTC build variables

Real `.env` files are ignored by Git.

## Project documentation

The original requirements/design trail is retained under `docs/`, along with phase notes for the incremental build. The current source tree and this README are the source of truth for the finished application.

## Finalization status

The feature roadmap is frozen. The remaining work after local verification is deployment configuration, hosted smoke testing, a two-physical-device WebRTC test, and submission/repository presentation.
