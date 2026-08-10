# SheyiHub Phase 7 — Live Meeting Room

Phase 7 builds directly on the Phase 6 RSVP/participant-management package and reuses the verified Phase 5 realtime socket and messaging stack.

## Added

### Live meeting lifecycle
- Host can start a scheduled meeting (`POST /api/meetings/{id}/start/`).
- Host can end a live meeting (`POST /api/meetings/{id}/end/`).
- `scheduled -> live -> ended` timestamps are persisted.
- Live meetings remain visible in the Upcoming view until ended.

### Realtime meeting membership
The existing authenticated `/ws/connect/` socket now also multiplexes meeting events:
- `meeting-join`
- `meeting-leave`
- `meeting-admit`
- `meeting-deny`
- `media-state`

Accepted invitees can join a live meeting. Waiting-room meetings place new invitees in `waiting` until the host admits them. Previously admitted users stay admitted after a transient reconnect. Unrelated users receive a non-disclosing `meeting_not_found` error.

### WebRTC signaling
Django Channels relays signaling only; media remains peer-to-peer between browsers:
- `webrtc-offer`
- `webrtc-answer`
- `ice-candidate`

The backend verifies that both sender and target are currently admitted participants before relaying SDP/ICE payloads.

### React live room
New route:

`/meetings/:id/room`

Includes:
- pre-join screen
- camera/microphone permission request
- local preview
- responsive video grid
- microphone mute/unmute
- camera on/off
- participant list
- waiting-room admit/deny controls for the host
- leave meeting
- host end-meeting control
- reconnect/rejoin handling

### Screen sharing
Any admitted participant can share a screen/window/tab. The active video sender track is replaced in-place, so no separate media server is required. Optional TURN credentials can be supplied for restrictive NATs.

### Meeting chat
Phase 7 reuses the Phase 5 `Conversation`/`Message` system rather than creating a second chat implementation.

`GET /api/meetings/{id}/conversation/`

lazily creates/synchronizes the meeting conversation for the host and accepted invitees. The live room exposes it in a Chat tab with the existing realtime send/read/typing behavior.

## WebRTC environment variables

Frontend `.env` supports:

```env
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

STUN is enough for many local/demo/network combinations. A real public deployment should configure TURN for reliable connectivity across restrictive NAT/firewall environments.

## Deliberately left for later

- collaborative whiteboard
- meeting file sharing
- browser notifications
- recording
- SFU/media-server scaling beyond the documented small mesh-call target

