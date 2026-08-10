# SheyiHub Phase 8 — File Sharing + Meeting Duration

## Added
- Shared files for DMs, group chats, and meeting conversations using the existing unified Conversation model.
- `POST/GET /api/conversations/{id}/files`
- `GET /api/files/{id}/download` (authenticated, participant-only; inline only for image/PDF previews).
- 25 MB server/client limit and MIME + extension allow-list.
- Realtime `file.shared` notification through the existing user WebSocket.
- Drag/drop uploads and byte-level upload progress.
- Image/PDF inline previews and authenticated downloads.
- Files remain available from meeting details after a meeting ends.
- Live meeting timer based on backend `actual_start`; ended meetings show recorded duration from `actual_start`/`actual_end`.

## Local storage
Development stores uploads beneath `backend/media/shared_files/...`. Production should move the FileField storage backend to S3-compatible object storage while keeping the same authorization API.

## Not changed
Phase 5 realtime messaging/presence and Phase 7 WebRTC signaling/media behavior are intentionally untouched.
