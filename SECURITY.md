# Security notes

SheyiHub is a portfolio/demo collaboration platform, but its production path is designed to avoid the most common deployment mistakes.

## Authentication

- Short-lived JWT access tokens are kept in memory, not localStorage.
- Refresh tokens are `HttpOnly`, `Secure` in production, rotated, and blacklisted on rotation/logout.
- Refresh requests use a double-submit CSRF token.
- Native WebSocket authentication uses a random single-use, 30-second ticket instead of placing the JWT in a URL. Ticket issuance is rate-limited.
- WebSocket handshakes are origin-checked against Django `ALLOWED_HOSTS` in production.
- Password reset responses do not disclose whether an account exists.

## Transport and browser hardening

Production enables HTTPS redirect, secure cookies, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, a restrictive referrer policy, Django 6 CSP middleware, and a Permissions-Policy that only allows camera/microphone/screen capture to the app's own origin. HSTS starts with a short duration by default so a new hostname can be proven before enabling subdomain/preload commitments.

## Authorization

Meeting, conversation, file, whiteboard, and notification endpoints are scoped server-side. Shared-file downloads return `404` to non-participants instead of exposing resource existence.

## File uploads

- Maximum 25 MB per file.
- Extension and MIME allow-list.
- Basic magic/signature validation for images, PDF, text/CSV, and Office formats.
- Randomized storage names; the original display filename is stored separately.
- Downloads are authenticated and served with `X-Content-Type-Options: nosniff`.

This is not an antivirus service. A public multi-tenant deployment should additionally scan uploads with a dedicated malware-scanning service before making them downloadable.

## Secrets

Never commit `.env` files, SMTP passwords, database URLs, Redis credentials, Sentry DSNs that should remain private, or long-lived TURN shared secrets. `VITE_*` values are compiled into browser JavaScript and must be treated as public.

## Production checks

With production environment variables set:

```bash
python manage.py check --deploy --settings=config.settings.production
```

SheyiHub adds its own deploy checks for secret strength, `DEBUG`, explicit allowed hosts, Redis Channels, and HTTPS configuration in addition to Django's built-in deployment checks.
