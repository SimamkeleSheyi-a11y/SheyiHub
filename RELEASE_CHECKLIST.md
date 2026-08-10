# SheyiHub release checklist

## Code verification

- [ ] `python manage.py migrate`
- [ ] `python manage.py makemigrations --check --dry-run`
- [ ] `pytest -v`
- [ ] `npm ci`
- [ ] `npm run build`
- [ ] `npm run lint`
- [ ] `npm run test`

## Manual smoke test

- [ ] Register / verify / login / refresh / logout
- [ ] Direct and group realtime messaging
- [ ] Presence, typing, read receipts
- [ ] Meeting create / invite / RSVP / start / join / waiting room / end
- [ ] Camera / microphone on two physical devices when available
- [ ] Screen sharing
- [ ] Meeting timer and persisted duration
- [ ] Chat + meeting file upload / preview / download / persistence
- [ ] Collaborative whiteboard realtime sync / undo / clear / persistence
- [ ] Notification bell, deep links, read state, preferences
- [ ] Profile / bio / avatar / theme persistence
- [ ] Mobile responsive pass

## Production configuration

- [ ] Strong `DJANGO_SECRET_KEY`
- [ ] Explicit `DJANGO_ALLOWED_HOSTS`
- [ ] HTTPS `FRONTEND_URL`
- [ ] PostgreSQL configured
- [ ] Redis configured for cache + Channels + Celery
- [ ] SMTP credentials configured
- [ ] Durable `/app/media` storage or object storage configured
- [ ] `python manage.py check --deploy --settings=config.settings.production` passes
- [ ] Health endpoint `/api/health` returns `200 {"status":"ok"}`
- [ ] WSS connects in browser console with no mixed-content errors
- [ ] Production file upload survives a service restart/redeploy
- [ ] TURN service tested from two different networks before claiming broad WebRTC reliability

## Repository/submission

- [ ] `.env`, database files, `media/`, `node_modules/`, build outputs are not committed
- [ ] README describes the current product, not old phase counts
- [ ] Repository has a clean default branch and meaningful commit history
- [ ] Hosted URL and GitHub URL work in a private/incognito browser
- [ ] No test credentials or secrets appear in README/screenshots
