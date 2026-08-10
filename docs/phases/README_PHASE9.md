# SheyiHub Phase 9 — Collaborative Whiteboard

Phase 9 adds a persistent, real-time whiteboard to the live meeting room without changing the working WebRTC media path.

## What changed

- A large meeting whiteboard can replace the video grid while audio/video connections keep running.
- Every admitted participant can draw with a pen or eraser.
- Pen colour and width controls are available in the room.
- Each user can undo their own most recent stroke.
- Only the host can clear the entire board, with a two-click confirmation in the UI.
- Strokes are sent over the existing authenticated Channels WebSocket and broadcast to the meeting group.
- Every accepted stroke is persisted as normalized vector points (`0..1` coordinates), so it scales correctly on different screen sizes.
- The meeting details page renders the saved whiteboard after the meeting ends.
- Pending/declined invitees and outsiders cannot read the saved board.
- Drawing/erase/undo/clear commands are rejected unless the sender is an admitted participant in a live meeting.

## API / realtime surface

REST snapshot:

- `GET /api/meetings/{id}/whiteboard/`

Client → server WebSocket events:

- `whiteboard-stroke`
- `whiteboard-undo`
- `whiteboard-clear` (host only)

Server → client events:

- `whiteboard.stroke`
- `whiteboard.removed`
- `whiteboard.cleared`

## Migration

Run:

```powershell
python manage.py migrate
```

This creates `meetings_meetingwhiteboardstroke` via `meetings/0003_meetingwhiteboardstroke.py`.

## Verification

Automated coverage added for:

- persisted snapshot access by host;
- accepted invitee access after the meeting ends;
- pending invitee and outsider access denial;
- admitted participant realtime stroke persistence/broadcast;
- non-admitted drawing rejection;
- host-only clear;
- participant undo of their own latest stroke.

Manual two-browser proof should verify:

1. Host and accepted participant join a live meeting.
2. Host opens the pencil/whiteboard control.
3. User A draws; User B sees the stroke without refreshing.
4. User B draws in another colour; User A sees it.
5. Eraser removes part of an existing stroke for both users.
6. Undo removes only that user's latest stroke for both users.
7. A non-host cannot clear the whole board; host can clear after confirmation.
8. Draw again, end the meeting, then open meeting details and confirm the saved board is still visible.
9. Resize the browser/mobile viewport and confirm the drawing keeps the same proportions.

## Local server

Use an ASGI server for local realtime work:

```powershell
$env:DJANGO_SETTINGS_MODULE="config.settings.development"
python -m daphne -b 127.0.0.1 -p 8000 config.asgi:application
```

Vite continues to proxy `/api` and `/ws` to port 8000.
