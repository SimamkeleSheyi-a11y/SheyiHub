# SheyiHub Phase 10 — Notifications

Phase 10 adds a persistent in-app notification system on top of the verified Phase 9 collaboration stack.

## Backend

- `notifications.Notification` stores unread/read state across refreshes and reconnects.
- `notifications.NotificationPreference` stores per-user message, meeting, file and browser-alert preferences.
- `GET /api/notifications/`
- `GET /api/notifications/unread-count`
- `POST /api/notifications/{id}/read`
- `POST /api/notifications/mark-all-read`
- `GET/PATCH /api/notifications/preferences`
- Notifications are emitted for:
  - new messages
  - meeting invitations
  - meeting accept/decline responses
  - meeting starts
  - shared files
- Each persisted notification is also pushed over the existing authenticated Channels socket as `notification.created`.

## Frontend

- Working bell menu in the top bar with unread badge.
- Realtime notification updates without refresh.
- Mark-one / mark-all-read.
- Click a notification to navigate to its chat or meeting.
- Full `/notifications` history page.
- Notification preferences in Settings.
- Optional browser notifications are only requested after an explicit user click and are shown while the tab is in the background.

## Migration

Run:

```powershell
python manage.py migrate
```

The new migration is `notifications/0001_initial.py`.

## Manual acceptance

1. User A sends User B a chat message. User B's bell badge increments without refresh.
2. User B opens the bell and clicks the alert. It opens the correct chat and the item becomes read.
3. User A schedules a meeting for User B. User B receives a meeting-invite notification.
4. User B accepts. User A receives an RSVP notification.
5. User A starts the meeting. User B receives a start notification that opens the room.
6. User A shares a file. User B receives a file notification.
7. Mark all notifications read and confirm the badge returns to zero.
8. Disable Messages in Settings, send another message, and confirm no message notification is created for that user.
9. Re-enable Messages.
10. Enable browser notifications, background the SheyiHub tab, then trigger an alert and confirm the desktop notification appears (browser permission permitting).
