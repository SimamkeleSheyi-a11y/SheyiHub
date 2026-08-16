# SheyiHub V4 backend patch

This patch is deliberately additive. It does **not** replace `apps/users`, so the production email-verification work stays intact.

It adds:
- `apps.workspaces`: workspace ownership, roles, members, member management.
- `apps.tasks`: real persisted workspace Kanban tasks.
- API routes `/api/workspaces/` and `/api/tasks/`.
- Global search endpoint `/api/search/` across workspace-visible people, messages, meetings, workspaces and tasks.
- Production Channels/Redis connection hardening.

## Redis rationale
The project pins `redis==8.0.1`. redis-py 8 uses a 5-second default socket read timeout, while Channels maintains blocking receive operations. The production patch supplies explicit connection kwargs to the channel-layer host: 30s socket read timeout, 5s connect timeout, TCP keepalive and a 30s health check. This avoids the 5-second read-timeout race observed in the Render WebSocket logs while still failing fast on initial connection problems.

## Apply
From the SheyiHub project root:

```powershell
python .\sheyihub-v4-backend-patch\apply_backend_v4.py
cd backend
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py check
pytest -q
```

If your patch folder has another location, call the script from there while your current working directory remains the SheyiHub project root.
