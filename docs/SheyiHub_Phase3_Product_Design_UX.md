# SheyiHub — Phase 3: Product Design & User Experience

**Status:** Phase 3 — design only. No React, HTML, CSS, or implementation code included, per scope.
**Builds on:** Phase 1 (requirements) and Phase 2 (system architecture), both approved. Screen names and features below map directly to Phase 2 §7's component hierarchy.

## Contents
1. [Product information architecture](#1-product-information-architecture)
2. [UX design — user flows](#2-ux-design--user-flows)
3. [Design system](#3-design-system)
4. [Responsive design](#4-responsive-design)
5. [Accessibility](#5-accessibility)
6. [Motion design](#6-motion-design)
7. [Figma blueprint](#7-figma-blueprint)
8. [Component inventory](#8-component-inventory)
9. [Critical self-review](#9-critical-self-review)

---

## 1. Product information architecture

### Navigation structure

**Persistent primary nav (sidebar):** Dashboard, Meetings, Chats, Settings. Each is a top-level section with its own sub-screens.

**Persistent top bar:** search, presence/status selector, theme toggle, notification bell, profile menu.

**Contextual nav:** inside a live meeting, a side-panel tab strip (Chat / Whiteboard / Files / Participants) replaces the main sidebar's relevance — the call itself becomes the focus. Inside Settings, a sub-nav (Profile / Appearance / Notifications) sits within the content area.

### Sitemap

*(top-level shown above; full route tree:)*

```
/                          → redirect based on auth state
/login
/register
/verify-email
/reset-password
/dashboard                 → home: upcoming meetings, quick actions, recent activity
/meetings
  /meetings/schedule
  /meetings/:id            → detail / lobby before joining
  /meetings/:id/room       → the live call
  /meetings/history
  /meetings/history/:id
/chats
  /chats/:conversationId
/notifications
/settings
  /settings/profile
  /settings/appearance
  /settings/notifications
```

### Screen hierarchy

- **Level 0 — Gateway:** Login, Register, Verify Email, Reset Password. No persistent chrome; single centered card on a plain background.
- **Level 1 — App shell:** Dashboard, Meetings, Chats, Settings all live inside the same persistent sidebar + top bar shell.
- **Level 2 — Immersive:** Meeting Room replaces the shell entirely (full-viewport call, its own contextual nav) — the one screen that deliberately breaks out of Level 1's chrome, because the call is the point.
- **Level 3 — Overlays:** modals and panels (waiting-room admit queue, invite dialog, confirm-cancel, notification dropdown) float above whichever level is active underneath.

### User journeys

**New user onboarding:** Register → check-email screen → click verification link → land on login with a success banner → log in → Dashboard is empty → empty state prompts "Schedule your first meeting" or "Join with a link."

**Host running a scheduled meeting:** Dashboard → Schedule → (time passes, reminder notification arrives) → click through to Lobby → Join as host → admit participants from the waiting room → run the call → leave → meeting appears in History with chat log, files, and whiteboard snapshot attached.

**Casual chat → spontaneous call:** Notification of a new DM → open Chats → reply → conversation escalates → start a voice/video call directly from that conversation (reuses the same Lobby → Live call flow, just entered from Chats instead of Meetings).

## 2. UX design — user flows

Flow diagrams above cover the sitemap and the join-meeting decision branch in detail (the flow with genuine branching logic). The rest are largely linear and are specified step-by-step below.

**Login:** Enter email + password → submit → invalid credentials show an inline error and the form stays filled → unverified account redirects to a "verify your email" screen with a resend option → success lands on Dashboard.

**Registration:** Enter email, password, display name → inline validation (email format, password strength) as they type → submit → "check your email" confirmation screen → clicking the emailed link redirects to Login with a success banner.

**Dashboard:** Land on Dashboard → see upcoming meetings (next 24–48h), quick actions (Start instant meeting / Schedule), and recent activity (unread chats, recently shared files) → any card opens directly into that item.

**Join meeting:** *(see flow diagram)* Click a meeting link or card → Lobby (camera/mic preview, device selection) → Join → waiting room or direct entry → Live call.

**Schedule meeting:** Click Schedule → form (title, date/time, invitees, waiting-room toggle) → submit → confirmation → invitees notified → meeting appears on Dashboard and in Meetings.

**Video conference:** Enter the call → grid populates as participants join, active speaker highlighted → control bar always visible (mute, camera, share, leave) → side panels (chat/whiteboard/files/participants) toggle on demand → Leave returns to Meeting detail/History.

**Chat:** Open Chats → pick a conversation or start a new one → paginated history loads, newest at the bottom → type and send → delivery, read receipts, and typing indicators update in real time for everyone.

**Whiteboard:** Open the Whiteboard panel inside a meeting → toolbar (pen, shapes, sticky note, eraser, color) → draw → strokes sync live to everyone in the call → host can clear → the board auto-saves and is viewable later from that meeting's history.

**File sharing:** Drag a file into the meeting window (or use the panel's upload button) → progress shown inline → file appears in the shared list for everyone → click to preview (images/PDFs) or download.

**Notifications:** Bell icon shows an unread count → click opens a dropdown grouped by recency → clicking an item navigates to the relevant screen → "mark all read" available → link through to notification preferences.

**Settings:** Navigate to Settings → Profile / Appearance / Notifications tabs → edit a field → confirmation toast on save.

## 3. Design system

### Design direction

SheyiHub's whole premise is *liveness* — the product exists for the moment people are actually present together. Rather than the indigo-on-white register most collaboration tools default to, the identity leans into that: **Pine**, a deep forest green, as the structural/brand color, paired with **Ember**, a warm amber, for anything happening *right now* — a live call, an unread badge, a primary action. Green as "go / on-air / active" is a genuinely old visual convention (traffic lights, broadcast tally lights); using a considered, desaturated version of it as the brand color — not just a small presence dot — makes liveness part of the product's identity rather than an afterthought icon.

### Color palette

| Name | Hex | Role |
|---|---|---|
| **Pine** | `#1F4B3F` | Brand/structural — sidebar, headers, dark-mode base, focus rings |
| **Ember** | `#E29544` | Accent — primary buttons, live/recording indicators, unread badges |
| **Stone** | `#F6F4F0` (light) → `#1C1A17` (dark) | Neutral scale — warm-tinted, not cold gray; backgrounds, borders, body text |
| **Signal** | `#3FA66B` | Status — online, success, "admitted" |
| **Rust** | `#C1523A` | Status — error, offline/busy, "denied" |

Dark mode isn't a separate gray theme bolted on — its base (`#14201B`) carries a whisper of Pine's green rather than going neutral black, so both modes read as the same brand.

### Typography

Three faces, each with a distinct job — not one font stretched across every role:

| Role | Face | Used for |
|---|---|---|
| Display/heading | **Space Grotesk** (600) | H1–H2, empty-state headlines, the login/register moment |
| Body/UI | **General Sans** (400/500/600) | Everything else — labels, body text, H3, buttons |
| Utility/mono | **IBM Plex Mono** (400) | Timestamps, room codes, meeting IDs — anything system-generated |

**Type scale**

| Level | Face | Size / line-height | Weight |
|---|---|---|---|
| Display | Space Grotesk | 32 / 40 | 600 |
| H1 | Space Grotesk | 24 / 32 | 600 |
| H2 | Space Grotesk | 18 / 26 | 600 |
| H3 | General Sans | 15 / 22 | 600 |
| Body | General Sans | 14 / 22 | 400 |
| Small | General Sans | 12 / 18 | 400 |
| Micro (labels) | General Sans | 11 / 16, +0.04em tracking | 500 |
| Mono | IBM Plex Mono | 12 / 18 | 400 |

### Spacing, radius, elevation

- **Spacing:** 4px base unit — 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- **Radius:** 4px (chips, badges) · 8px (default — buttons, inputs, cards) · 12px (larger cards) · 16px (modals, large panels) · full (pills, avatars).
- **Elevation** (shadow color derived from Pine, not generic black, so shadows read warm rather than cold):

| Level | Use | Shadow |
|---|---|---|
| 0 | Flat/inline | none |
| 1 | Resting card | `0 1px 2px rgba(20,32,27,.06), 0 1px 3px rgba(20,32,27,.08)` |
| 2 | Dropdown, popover | `0 4px 8px rgba(20,32,27,.10), 0 2px 4px rgba(20,32,27,.08)` |
| 3 | Modal | `0 12px 24px rgba(20,32,27,.14), 0 4px 8px rgba(20,32,27,.10)` |
| 4 | Toast | `0 16px 32px rgba(20,32,27,.18), 0 6px 12px rgba(20,32,27,.12)` |

### Icons

**Lucide**, outline/regular weight — a consistent, single-source icon set. 20px default, 16px in compact contexts (table rows, chips), 24px in empty states.

### Signature element — the Live Pulse

The one deliberately memorable, deliberately restrained piece of the identity: anything genuinely live right now — a meeting in progress, someone actively speaking, an incoming call — gets a soft Ember ring around it that breathes rather than blinks: opacity 40%→90%→40% on a slow 2.4s ease-in-out loop, 2px wide, offset 4px from the element it surrounds. It appears *only* on truly live states (never decoratively), which is what makes it mean something.

### Core components

**Buttons** — Primary (filled Ember, dark text for contrast), Secondary (Pine outline), Ghost (text-only, Stone hover background), Destructive (filled Rust, white text), Icon-only. Sizes sm/md/lg (32/40/48px height). States: default, hover, active (98% scale), focus (2px Ember ring), disabled (40% opacity), loading (spinner replaces label, width unchanged to avoid layout shift).

**Form controls** — Text input & textarea (40px height, Stone border, Ember focus ring, Rust border + inline message on error), Select (input styling + chevron), Checkbox/Radio (18px, Pine fill when active), Toggle switch (40×22px pill), Date/time picker (popover calendar, for scheduling), File dropzone (dashed border, Ember on drag-over).

**Cards** — 8–12px radius, elevation 1 at rest → 2 on hover if interactive, 16–20px internal padding. Used for meeting cards, file cards, conversation list items.

**Tables** — used for meeting history and participant lists. 44px rows, Stone-tinted header with micro-label styling, horizontal hairlines only (no vertical rules), subtle row hover.

**Navigation** — Sidebar (240px expanded / 64px icon-only collapsed), top bar (56px), tabs use an Ember underline for the active state rather than a filled pill — reads as focused rather than playful.

**Modals** — centered, 480px (confirmations) to 640px (forms), elevation 3, Pine-tinted scrim at 40% opacity, 16px radius, closes via Esc / backdrop / explicit close.

**Toasts** — bottom-right, stack up to 3 with an "+N more" collapse, 4s auto-dismiss (8s for errors), elevation 4, colored left border by type (Signal/Rust/Ember).

**Loading states** — skeleton screens shaped like the real content for lists/cards (a slow opacity pulse, not a spinner); an inline spinner only for button-level actions; a full-screen loader only on initial app boot.

**Empty states** — icon + short headline + one supporting line + a primary action, written as an invitation, not an apology:
- No meetings: *"No meetings yet" — "Schedule one to get your team together." → [Schedule a meeting]*
- No messages: *"Nothing here yet" — "Send the first message to start the conversation."*
- No notifications: *"You're all caught up"* — no CTA needed; this one's a reward, not a prompt.

**Error states** — inline field errors are specific ("Password must be at least 8 characters," never "Invalid input"); a persistent, non-dismissible "Reconnecting…" banner during an in-call connection drop; a plain "You don't have access to this meeting" for permission failures; a failed upload gets a reason and a retry button, not a dead end.

## 4. Responsive design

| Breakpoint | Range | Sidebar | Video grid | Side panels |
|---|---|---|---|---|
| Mobile | < 640px | Bottom tab bar | Single active speaker + swipeable strip | Full-screen overlay |
| Tablet | 640–1023px | Icon-only rail | 2×2 / 3×3 by orientation | Slide-over |
| Laptop | 1024–1439px | Full sidebar | Adaptive grid (default) | Docked panel |
| Desktop | 1440–1919px | Full sidebar, more breathing room | Adaptive grid | Docked, more generous padding |
| Ultra-wide | ≥ 1920px | Full sidebar | Grid caps at a max tile size (no oversized stretching) | Can stay permanently docked alongside video rather than toggled |

Whiteboard and precise drawing are treated as a known constraint on mobile rather than pretending full parity — see §9.

## 5. Accessibility

- **WCAG target:** AA (Phase 1 §3). Color is never the only signal — presence status pairs a shape/icon with its color (a solid dot + a small check for online, not just "green"), since green/gray or green/red alone fails for colorblind users.
- **Keyboard navigation:** full tab order matching visual layout; shortcuts for common in-call actions matching conventions people already know from Zoom/Meet (`M` mute, `V` camera); `Esc` closes modals/panels; `Enter`/`Space` activates the focused control.
- **Focus management:** visible focus rings always (never removed without a replacement); focus is trapped inside open modals; focus returns to the triggering element on close; opening a side panel moves focus to its first interactive element.
- **Screen reader support:** semantic landmarks (`nav`, `main`, `aside`); real-time updates (new message, participant joined) announced via a polite live region, not an interrupting one; video tiles labeled with participant name; custom controls (whiteboard tools, mute) carry descriptive labels and reflect state (pressed/unpressed).
- **Color contrast:** 4.5:1 minimum for body text, 3:1 for large text and UI components — a check to run explicitly against the final Pine/Ember/Stone values once built, not assumed from the palette alone.
- **Reduced motion:** `prefers-reduced-motion` disables non-essential motion (page transitions, hover elevation, the Live Pulse's breathing animation drops to a static ring) while essential state feedback (a loading indicator existing at all) is kept, just simplified.

## 6. Motion design

**Principles:** every animation communicates a state change or spatial relationship — nothing moves purely for decoration. Fast by default; the UI should feel instant, not performed.

| Speed | Duration | Easing | Use |
|---|---|---|---|
| Fast | 100–150ms | `cubic-bezier(.4,0,1,1)` (ease-in) | Hover/press feedback, exits |
| Base | 200–250ms | `cubic-bezier(.4,0,.2,1)` (standard) | Most transitions, toggles |
| Slow | 350–400ms | `cubic-bezier(0,0,.2,1)` (ease-out) | Page/panel entrances |
| Ambient | 2.4s loop | ease-in-out | Live Pulse only |

- **Page transitions:** subtle fade + 8–12px slide, not a full wipe. Modals scale from 96%→100% while fading in.
- **Hover effects:** elevation +1 on interactive cards, background tint on buttons/list rows — no scale or rotation gimmicks; this is a productivity tool, not a playful consumer app.
- **Loading animations:** skeletons pulse gently (1.5s loop); button-level spinners for async actions.
- **Micro-interactions:** toggle switches spring slightly; the notification bell gives a brief shake on a new arrival; a reaction "pops" briefly when added; the typing indicator uses three dots with a staggered bounce.

## 7. Figma blueprint

*(consistent template per screen: layout, key elements, hierarchy, interaction. Verify Email and Reset Password follow Login's pattern; Meeting History follows Dashboard's list pattern — not repeated separately.)*

**Login**
- *Layout:* centered card (400px) on a plain Stone-50 background; no sidebar/top bar.
- *Elements:* SheyiHub wordmark (Space Grotesk) above the card; email field, password field, primary "Log in" button (full-width), "Forgot password?" link, "Create an account" link below the card.
- *Hierarchy:* wordmark → form → secondary links, in that visual weight order.
- *Interaction:* inline validation on blur; primary button disabled until both fields are non-empty; Enter submits.

**Dashboard**
- *Layout:* sidebar + top bar shell; content area is a single column capping at ~960px, centered with room to breathe on wider viewports.
- *Elements:* greeting header, "Start meeting" / "Schedule" quick actions side by side, "Upcoming" card list (next 24–48h), "Recent activity" list (unread chats, recent files) below it.
- *Hierarchy:* quick actions sit highest (Ember primary button draws the eye first), upcoming meetings second, activity feed third.
- *Interaction:* any card is fully clickable, not just a link within it; empty sections show the empty states from §3.

**Schedule meeting**
- *Layout:* modal (640px) over whichever screen it was opened from.
- *Elements:* title field, date/time pickers, invitee multi-select (search-as-you-type), waiting-room toggle, "Schedule" primary button + "Cancel" ghost button.
- *Hierarchy:* title first (largest field), then when, then who, then options — matches how a person actually thinks through scheduling something.
- *Interaction:* invitee search queries the user directory live; waiting-room toggle defaults on for meetings with 3+ invitees, off for 1:1s (a small default that saves a click for the common case).

**Meeting lobby**
- *Layout:* centered card over a dimmed background; camera preview is the dominant visual element.
- *Elements:* live camera preview, camera/mic toggle controls beneath it, device-selection dropdown, meeting title + host name, primary "Join" button.
- *Hierarchy:* the preview itself is the focal point — everything else is secondary chrome around it.
- *Interaction:* toggling camera/mic updates the preview instantly; "Join" shows a brief loading state while the connection negotiates.

**Meeting room (live call)**
- *Layout:* full-viewport, no sidebar/top bar. Video grid fills the space; a docked side panel (Chat/Whiteboard/Files/Participants) can open on the right (laptop+) or as an overlay (mobile/tablet); a control bar is fixed at the bottom-center.
- *Elements:* participant tiles (name label, mute/camera-off indicators, active-speaker highlight), control bar (mute, camera, share, panel toggle, leave), waiting-room badge on the host's panel toggle when requests are pending.
- *Hierarchy:* video is always primary; the control bar is persistent but visually quiet until hovered/focused; the Live Pulse marks the call as active on any card referencing it elsewhere in the app.
- *Interaction:* grid re-flows automatically as participants join/leave; screen share replaces the grid with the shared content plus a strip of participant thumbnails; leaving prompts a lightweight confirmation only if the user is the host (to avoid accidentally ending it for everyone).

**Chat**
- *Layout:* two-column — conversation list (320px) + active conversation, or single column with a back affordance on mobile.
- *Elements:* conversation list items (avatar, name, last-message preview, unread badge, presence dot), message thread (bubbles, sender name on group chats, timestamps in mono type), composer with attach/emoji/send.
- *Hierarchy:* unread conversations are visually distinct (bold text + Ember badge) from read ones.
- *Interaction:* typing indicator appears beneath the thread; read receipts show as a small checkmark under the sender's own last message; new messages auto-scroll unless the user has scrolled up to read history.

**Settings**
- *Layout:* sidebar + top bar shell; content area has its own left sub-nav (Profile / Appearance / Notifications) beside the form.
- *Elements:* Profile (avatar upload, display name, email — read-only), Appearance (theme toggle: Light/Dark/System), Notifications (per-category in-app/browser toggles matching Phase 1's `NotificationPreference` model).
- *Hierarchy:* sub-nav is quiet (text links, not tabs) since it's a low-frequency destination.
- *Interaction:* each section saves independently with its own confirmation toast, so changing one setting never risks accidentally reverting another mid-edit.

## 8. Component inventory

| Category | Components |
|---|---|
| Layout | Sidebar, TopBar, PageContainer, SplitPanel |
| Navigation | NavItem, Tabs, SubNav |
| Actions | Button, IconButton, DropdownMenu, ButtonGroup |
| Forms | TextInput, TextArea, Select, Checkbox, RadioGroup, ToggleSwitch, DateTimePicker, FileDropzone |
| Content | Card, MeetingCard, ConversationListItem, MessageBubble, FileCard, NotificationItem, Avatar, Badge, PresenceDot |
| Feedback | Toast, Modal, ConfirmDialog, Tooltip, Banner |
| Data display | Table, EmptyState, SkeletonLoader, ProgressBar |
| Call-specific | ParticipantTile, VideoGrid, ControlBar, WaitingRoomList, ScreenShareIndicator, LivePulse |
| Whiteboard-specific | WhiteboardCanvas, ToolBar, ColorPicker, StickyNote |
| Misc | ThemeToggle, SearchInput, TypingIndicator, ReadReceiptIndicator |

## 9. Critical self-review

**Weaknesses, named plainly:**

1. **"Comparable to six different products" is a tension, not a solved problem.** Linear's stark minimalism, Discord's playful dark-first identity, and Teams' enterprise formality don't actually point the same direction. This design leans toward Linear/Notion's calm-productivity register over Discord's playful-community one, since the feature set (scheduled meetings, host controls, waiting rooms) skews more toward organized work than drop-in social hangout. That's a real choice, made explicitly here — not a neutral average of all six.
2. **Density vs. accessibility is a genuine trade-off, not a free win.** 14px body text and tight spacing read as sophisticated (Notion/Linear-style) but work against larger touch targets and generous spacing that help low-vision and motor-impaired users. The type scale and spacing system above are a reasonable middle ground, but this deserves real user testing, not just a design-system assertion that it's fine.
3. **The whiteboard has no honest mobile answer yet.** Precise freehand drawing on a small touchscreen is a hard problem that "make it responsive" doesn't actually solve. The realistic path is a deliberately reduced mobile toolset (view + simple annotations, not full parity) rather than pretending the laptop experience shrinks down cleanly — flagged here rather than discovered late.
4. **The motion list is a lot of small things.** Each micro-interaction (typing dots, reaction pop, bell shake, Live Pulse) is cheap individually but adds up in implementation and QA surface. These should be treated as progressively-enhanced polish in a later phase — cutting any of them under time pressure should never break core function, and that constraint should be explicit before Phase 4 estimates get made.
5. **The palette has room to grow, but that room isn't infinite.** Pine/Ember/Stone/Signal/Rust covers the current feature set cleanly. A future integrations page, more granular status states, or a second accent for some new feature will need to extend this deliberately (documented token additions) rather than reach for whatever hex looks close — worth stating now, before that pressure exists.

**Why these choices support usability, scalability, and maintainability:**

- **Usability:** every interactive pattern (buttons, forms, empty/error states) is defined once and reused everywhere, so a person only has to learn what a "primary button" or an "empty state" means one time across the whole product, not once per screen.
- **Scalability:** the token system (color, type, spacing, radius, elevation) means a new screen or component inherits consistency automatically instead of each new feature needing its own design decisions from scratch — Phase 2's data model growth (new entity → new screen) has a design system ready to absorb it.
- **Maintainability:** the component inventory's categories mirror Phase 2's feature-based folder structure (`features/meetings/` ↔ Call-specific components, `features/whiteboard/` ↔ Whiteboard-specific components) — design organization and code organization tell the same story, so "where does this belong" has one answer, not two.
