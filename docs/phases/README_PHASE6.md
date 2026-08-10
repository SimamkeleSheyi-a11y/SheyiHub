# SheyiHub Phase 6 — Meetings RSVP & Participant Management

Phase 6 builds on the verified Phase 5 mobile/realtime baseline. It does not replace or rewrite Phase 5 messaging, presence, typing, read receipts, reconnection, or responsive chat behavior.

## Added in Phase 6

- Meeting RSVP state exposed to the current invitee (`pending`, `accepted`, `declined`).
- Host participant management endpoint:
  - `GET /api/meetings/{meeting_id}/participants/`
  - `POST /api/meetings/{meeting_id}/participants/` with `{ "email": "user@example.com" }`
  - `DELETE /api/meetings/{meeting_id}/participants/{invite_id}/`
- Invitee RSVP endpoint:
  - `POST /api/meetings/{meeting_id}/respond/` with `{ "response": "accept" }` or `{ "response": "decline" }`
- Cancelled meetings list scope (`?scope=cancelled`).
- History scope excludes cancelled meetings.
- Meeting detail now includes participant/invite records with RSVP status.
- Meeting frontend now lets hosts invite/remove registered users and lets invitees accept/decline invitations.
- Meetings page now has Upcoming, History, and Cancelled tabs.
- Focused backend tests were added for participant permissions, RSVP behavior, removal, and meeting scopes.

## Deliberately not part of Phase 6

The live-call layer is still a later phase: WebRTC video/audio, waiting-room admission during a live call, screen sharing, meeting-room chat embedding, whiteboard, and meeting file sharing.

## Verification commands

Backend:

```powershell
cd backend
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py check
python -m pytest -v
```

Frontend:

```powershell
cd frontend
npm install
npm run build
npm test -- --run
```

The archive was statically checked for Python syntax. Full Django/Vite execution must be performed in the normal local development environment because this build environment does not provide the project's Python/Node dependencies.
