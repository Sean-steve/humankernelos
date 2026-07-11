# Plan: Polish live data + settings for Human OS v0.1

## Where we are now

The Human OS shell is built and most surfaces exist as real routes:

- 9 routes: Today, Check-in, Human State, Standards, Protocols, Achievements, Engines, Signals, Reflection
- Authentication works: email/password + Google OAuth, `useSession`, AccountBadge, `/auth`
- Backend persistence is live via Lovable Cloud:
  - `profiles`, `check_ins`, `reflections` tables with RLS
  - Server functions for submitting check-ins and reflections, listing history, and reading/updating the profile
- AI advisor is wired through the Lovable AI Gateway and the `system`-as-option bug is fixed
- Human State timeline already loads real `check_ins` when signed in
- Reflection journal already loads real entries when signed in

## What is still missing for the initial build

1. **Profile auto-creation on signup** — the `handle_new_user()` function exists but no trigger fires it, so new users may not have a `profiles` row.
2. **Home page is still mostly static** — it greets "Operator", shows seed human state, and the Advisor reads hardcoded values instead of the latest check-in.
3. **No settings page** — users cannot edit their name, becoming statement, primary standard, or identity statements.
4. **Identity statements are hardcoded** — the user wants them editable per user.
5. **A runtime module-loading error** is reported in the preview and should be investigated.

## What this plan will build

### 1. Database changes
- Add an `identity_statements` JSONB column to `profiles` so each user can store their own list.
- Attach the existing `handle_new_user()` function to a trigger on `auth.users` so every signup automatically gets a profile row.
- Update `updateMyProfile` validation to accept the new `identity_statements` array.

### 2. Home page becomes live
- Fetch the user's profile and latest check-in on mount.
- Use the profile's `name`, `becoming`, and `primary_standard` instead of static seed values.
- Feed the latest check-in state into the human-state grid and the Advisor so the homepage reflects reality.
- Show a "No check-in yet today" prompt that links to `/check-in` when appropriate.

### 3. New Settings page (`/settings`)
- Editable fields: name, becoming statement, primary standard, identity statements (add/remove/reorder).
- Saves through the existing `updateMyProfile` server function.
- Simple, calm UI matching the rest of the Kernel.

### 4. Navigation
- Add a "Settings" link in the sidebar near the AccountBadge.
- Add the same link inside the mobile drawer.

### 5. Verification
- Run a typecheck and a preview smoke test.
- Investigate and resolve the reported dynamic-module runtime error if it still appears.

## Out of scope for this phase

- Real third-party engine integrations (Body OS, Trading OS, etc.) remain static placeholders.
- Standards adherence tracking remains static; no daily standard-logging table yet.
- Achievements remain static seed values.

## Deliverables

- New `/settings` route
- Updated `profiles` schema + auto-create trigger
- Updated server functions
- Home page reading live profile + latest check-in
- Sidebar/drawer links to Settings
- A verified, type-clean build
