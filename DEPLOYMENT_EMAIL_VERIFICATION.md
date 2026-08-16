# SheyiHub 1.0 — Real Email + 6-Digit Verification

This patch changes new-account verification from manual database approval to a real six-digit email flow.

## User flow

`Register -> code is emailed -> enter 6 digits -> email_verified=True -> protected collaboration features unlock`

No normal user should ever need to be manually verified in VS Code, Django shell, or PostgreSQL.

## Security choices

- the raw six-digit code is **never stored in PostgreSQL**
- Django's password hasher stores only a salted hash
- code lifetime: 10 minutes by default
- resend cooldown: 60 seconds
- maximum wrong attempts per issued code: 5
- requesting a new code replaces the previous code
- resend responses do not reveal whether an account exists
- old verification links are kept working for backwards compatibility

## Files to copy

Backend:

- `backend/apps/users/models.py`
- `backend/apps/users/verification.py` (new)
- `backend/apps/users/tasks.py`
- `backend/apps/users/serializers.py`
- `backend/apps/users/views.py`
- `backend/apps/users/urls_auth.py`
- `backend/apps/users/migrations/0003_emailverificationcode.py` (new)
- `backend/apps/users/tests/test_email_verification_codes.py` (new)

Frontend:

- `frontend/src/features/auth/api.ts`
- `frontend/src/features/auth/RegisterPage.tsx`
- `frontend/src/features/auth/RegisterPage.css`
- `frontend/src/features/auth/VerifyEmailPage.tsx`
- `frontend/src/features/auth/VerifyEmailPage.css` (new)

Keep your existing Premium Auth V2 `LoginPage.css`; the Register and Verify screens share it.

## Local verification

From `backend`:

```powershell
python manage.py makemigrations --check --dry-run
python manage.py migrate
pytest -q
```

From `frontend`:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test
npm.cmd run dev
```

## Production email on the current Render setup

Your `production.py` already supports standard SMTP. The missing piece is a real SMTP account and delivery execution.

### Fast path without buying a domain: Brevo SMTP

Brevo lets you create and verify a sender email address. In Render, configure the values Brevo gives you:

```text
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_HOST_USER=<your Brevo SMTP login>
EMAIL_HOST_PASSWORD=<your Brevo SMTP key>
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
DEFAULT_FROM_EMAIL=<the sender email you verified in Brevo>
```

Never commit the SMTP key to GitHub.

### Current one-service Render deployment

Until you add a dedicated Celery background worker, set:

```text
CELERY_TASK_ALWAYS_EAGER=True
```

That makes verification/password-reset email tasks execute inside the running web service.

Later, for a serious production deployment, create a dedicated Render Celery background worker and change it back to:

```text
CELERY_TASK_ALWAYS_EAGER=False
```

The current Render Key Value/Valkey instance can continue to act as the Celery broker.

## Deployment sequence

1. Copy files.
2. Run backend + frontend checks locally.
3. Commit and push.
4. Render rebuilds the Docker image.
5. The Docker startup migration applies `0003_emailverificationcode`.
6. Add the SMTP environment variables in Render.
7. Set `CELERY_TASK_ALWAYS_EAGER=True`.
8. Redeploy.
9. Create a brand-new account with an email inbox you can access.
10. Confirm the six-digit email arrives and that entering it changes the account to verified.

Do not use your exposed old database credential. Rotate that credential if it has not already been rotated.
