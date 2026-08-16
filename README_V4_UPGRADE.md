# SheyiHub V4 — Full Product Upgrade

V4 builds on the premium responsive V3 shell and moves SheyiHub deeper into a real team-workspace product.

## Included

### Reliability and action feedback
- Realtime connection/reconnect banner instead of silent WebSocket failure.
- Exponential WebSocket reconnect state exposed to the UI.
- Existing chat REST fallback preserved.
- Dashboard instant meeting now has verification guard, loading, success and real API error feedback.
- More destructive/notification actions surface success/error states instead of silently failing.

### Onboarding
- First-run onboarding route `/onboarding`.
- Guides verification/profile → workspace → collaboration.

### Real workspaces
- Persistent backend models and migrations.
- Owner/admin/member roles.
- Active workspace switcher in the premium shell.
- Add existing SheyiHub users by email.
- Workspace management page fully responsive.

### Real tasks / Kanban
- Persistent backend task model and migrations.
- To do / In progress / Review / Done.
- Priority, due date, search, move and delete.
- Workspace-scoped task board.
- Desktop and phone UI.

### Global search
- `/api/search/` backend endpoint.
- `Ctrl/Cmd + K` now searches people, messages, meetings, workspaces and tasks as well as app navigation.

### Navigation / responsive polish
- Workspaces and Tasks added to desktop sidebar.
- Tasks added to phone bottom navigation.
- Mobile Create sheet includes tasks.
- New screens use the same premium dark/violet responsive design.
- Global `Created by Simamkele Sheyi` credit remains.

### Redis / WebSocket hardening
The additive backend patch updates the production Channels Redis host kwargs with an explicit 30-second socket read timeout, 5-second connect timeout, TCP keepalive and a 30-second health check. This is aimed at the repeated 5-second `redis.exceptions.TimeoutError` seen in production logs.

## Important safety choice
The backend patch is **additive** and intentionally does not replace `apps/users`. Your current six-digit email verification implementation is left untouched.

## Install

### 1. Copy frontend
Copy this bundle's `frontend` contents over your current project `frontend` folder.

Then run:

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
npm.cmd run test
npm.cmd run dev
```

### 2. Apply backend patch
Return to the project root — the folder that contains `backend` and `frontend`.

Run:

```powershell
python "<EXTRACTED-BUNDLE-PATH>\backend_patch\apply_backend_v4.py"
```

The script only registers the new apps/routes, installs the additive app files and hardens the production Redis channel-layer block.

Then:

```powershell
cd backend
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py check
pytest -q
```

### 3. Test locally
Walk through:

```text
Login / verification
→ Dashboard
→ Workspaces: create workspace
→ Workspaces: add an existing SheyiHub member
→ Tasks: create/move/delete tasks
→ Ctrl+K global search
→ Chats realtime + reconnect indicator
→ Meetings create/start/join/end
→ Notifications
→ Settings
→ Phone responsive mode
```

### 4. Deploy only after local green

```powershell
git add .
git commit -m "Add SheyiHub V4 workspaces tasks search and realtime hardening"
git push origin main
```

Your existing Docker startup migration command can then apply the two new migrations on Render.
