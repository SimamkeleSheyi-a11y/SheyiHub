# SheyiHub Phase 11 — Product Polish & Settings

Phase 11 deliberately stops adding major collaboration systems. It polishes the account/settings experience and makes profile choices visible across the product while preserving the verified Phase 10 collaboration stack.

## Profile polish

- Editable display name.
- Optional avatar URL with a safe initials fallback when blank or unreachable.
- New 240-character bio field (`users/0002_user_bio.py`).
- Live profile preview before saving.
- Unsaved-change detection, Reset action and saved state.
- Verification badge and member-since information.
- Profile avatars now appear in the top-bar account menu, DM header, meeting participant list and waiting room.

## Appearance

- Dedicated Light / Dark / System appearance controls in Settings.
- Theme remains immediately responsive and is persisted through the existing user preference API.
- The top-bar theme control is hidden on narrow mobile layouts to reduce crowding; Settings remains the full appearance control surface.

## Notifications

- Existing Phase 10 preferences are reorganized into the polished Settings page.
- Loading skeletons, retry UI and mutation error feedback were added.
- Browser-notification permission remains explicit opt-in.

## Account & security

- Email verification status is visible in Settings.
- Unverified users can resend verification from Settings.
- Users can request a password-reset email from Settings using the existing secure reset flow.

## Responsive / accessibility polish

- Settings is responsive from mobile through desktop.
- The top-bar presence control collapses to its status dot on small screens.
- Account controls have explicit accessible names and menu roles.
- Avatar images use an initials fallback instead of leaving broken image chrome.
- Existing reduced-motion and focus-visible behavior remains intact.

## Backend API changes

`GET/PATCH /api/users/me` now includes:

- `bio`
- `created_at` (read-only)

Existing fields remain unchanged.

## Migration

```powershell
python manage.py migrate
```

New migration: `users/0002_user_bio.py`.

## Manual acceptance

1. Open Settings and confirm the current profile is pre-filled.
2. Change display name and bio, save, refresh, and confirm both persist.
3. Add a valid avatar URL and confirm it appears in Settings, the account menu, a DM header, and meeting participant UI.
4. Enter an invalid/broken avatar URL and confirm initials appear instead of a broken image.
5. Change Light / Dark / System and confirm the UI switches immediately and remains correct after refresh/login.
6. Toggle each notification category and confirm the existing Phase 10 behavior still respects the preference.
7. Confirm verified accounts show Verified; on an unverified test account, confirm Resend verification is available.
8. Click Send reset link and confirm the development email is produced without exposing password data.
9. Resize to a phone-width viewport and confirm the top bar and Settings page do not overflow horizontally.
10. Regression-check chat, presence, meetings, files, whiteboard and notifications.
