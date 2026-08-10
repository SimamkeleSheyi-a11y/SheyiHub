# Production hardening summary

This release freezes SheyiHub's feature set and focuses on production safety, deployment repeatability, and repository presentation.

## Added or hardened

- Separate production and Docker-development settings.
- Required production secrets/hosts/database/Redis/SMTP configuration.
- Redis-backed Channels and cache in production.
- ASGI production image using Gunicorn with a Uvicorn worker.
- Same-origin React + Django production build with WhiteNoise static assets.
- Database/cache readiness endpoint at `/api/health`.
- HTTPS redirect, secure cookies, HSTS rollout controls, CSP, referrer, framing, MIME and Permissions-Policy headers.
- WebSocket origin validation against `ALLOWED_HOSTS` and rate-limited short-lived ticket issuance.
- Stronger shared-file handling: random storage names, allow-list/size checks, basic content-signature validation, authenticated downloads.
- Production upload memory limits, persistent database connections, logging and optional Sentry integration.
- Root production Dockerfile, safer Docker Compose development stack, `.dockerignore`, and production environment template.
- Deployment, security and release-checklist documentation.
- Old phase notes moved under `docs/phases/` so the repository root reflects the finished product.

## Verification required before release

Run the full backend and frontend automated suites on the target development machine, then complete `RELEASE_CHECKLIST.md`. Before a public deployment, also run Django's production deploy checks with real production environment variables and complete a hosted smoke test.

The codebase intentionally does **not** claim reliable WebRTC connectivity across arbitrary networks until TURN is configured and a two-physical-device, different-network test succeeds.
