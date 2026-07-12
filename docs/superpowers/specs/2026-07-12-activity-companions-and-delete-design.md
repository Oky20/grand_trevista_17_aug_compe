# Design: Show Training Partners & Self-Delete on Activity Cards

Date: 2026-07-12
Status: Approved

## Problem

On the "Activities" and "My Activities" tabs, activity cards don't show who
else joined the same session ("Training Partners" / companions), even though
that data is already collected at submission time. There's also no way for a
user to delete an activity they submitted by mistake or no longer want
counted.

## Scope

Two independent, additive changes to the user-facing app (`index.html` +
`js/api.js` + a new Supabase Edge Function). No changes to `admin.html`.

## A. Show companion names on activity cards

**Current state:** `activities.companions` (`UUID[]`) is already populated by
the submit flow (`index.html:775-838`, `supabase/functions/activity-submit/index.ts:51-54`)
and already comes back from `DB.getAllActivities()` (no explicit `select=`,
so all columns are returned). It's just not rendered anywhere.

**Change:** In both card-rendering functions —`rActs()` (`index.html:614-659`)
and `rMyActs()` (`index.html:661-735`) — resolve each UUID in `a.companions`
to a name via the existing `LB` array (same lookup pattern as
`rCompanionChips()`, `index.html:810-832`) and render one line under the
date/sport-type line:

```
🤝 with: Alice, Bob
```

- Only rendered when `a.companions` is non-empty.
- Unresolvable IDs (e.g. a companion account later deleted) are silently
  skipped rather than showing a blank/broken entry.
- Pure frontend change — no schema or backend change needed.

## B. Delete own activity

**Ownership & trust model:** This app has no real auth — `Session` is just a
user object in `localStorage` (`js/api.js:156-166`), and every existing write
(e.g. `activity-submit`) trusts `user_id` from the request body, doing the
real authorization server-side against the DB. Delete follows the same
pattern: the client sends `user_id`, but the edge function independently
verifies that the target activity actually belongs to that `user_id` before
deleting — the client is never trusted for authorization, only identification.

**Backend — new Edge Function `supabase/functions/activity-delete/index.ts`**
(mirrors `activity-submit/index.ts`):

- Request: `POST { activity_id, user_id }`
- Steps:
  1. Validate both fields present → 400 if missing.
  2. Using the service-role client (RLS on `activities` only allows
     `service_role` to write — `schema.sql:76`), fetch the activity by
     `activity_id`.
  3. If not found → 404.
  4. If `activity.user_id !== user_id` → 403 ("You can only delete your own
     activities.").
  5. Enforce the same submission window as `activity-submit`: reuse
     `jakartaDateKey` + `SUBMIT_WINDOW_DAYS = 7` to compute days since
     `activity.start_date`. If `daysSince > 7` → 400 ("Deletion window
     closed — activities can only be deleted within 7 days of the activity
     date.").
  6. Delete the row (`sb.from("activities").delete().eq("id", activity_id)`).
  7. Return `{ success: true }`.

**Frontend — `js/api.js`:**

- Add `Activity.delete(activityId)`, POSTing
  `{ activity_id: activityId, user_id: Session.get().id }` to the new
  function (same fetch/error-handling shape as `OCR.submitActivity`,
  `js/api.js:32-43`).

**Frontend — `index.html` card templates:**

- In both `rActs()` and `rMyActs()`, render a small delete button (🗑) on a
  card only when a session exists and `a.user_id === Session.get().id`.
  - In `rMyActs()` this is effectively every card (already scoped to "me").
  - In `rActs()` (all users' activities) this shows on the current user's
    own cards only, mixed in among everyone else's.
- Click handler:
  1. `window.confirm('Delete this activity? This cannot be undone and will remove its points.')`
     (native confirm, matching the existing pattern in `admin.html:315,322`
     for `delete_code` — no new modal component needed).
  2. On confirm, call `Activity.delete(a.id)`.
  3. On success: `toast('Activity deleted', 'success')`, then call
     `loadData()` (`index.html:356-370`) to re-fetch leaderboard + activities
     and re-render every affected view (cards, points, team totals) in one
     call — no manual local state patching needed.
  4. On error (not owner, window closed, network failure): `toast(message, 'error')`,
     no local state change.

**Out of scope:** Deleting associated images from storage — confirmed there
is none. `image_path` is not an actual storage path; it's set to the
activity's date string purely as a flag to derive `submission_method`
(`"image_ocr"` vs `"manual"`, `activity-submit/index.ts:77`). The uploaded
screenshot is base64-encoded and sent transiently to the Gemini OCR function
for analysis and is never persisted to Supabase Storage anywhere in this
codebase.

## Testing

- Manual verification (no automated test suite in this repo):
  - Submit an activity with 2+ training partners, confirm names appear on
    both "Activities" and "My Activities" cards.
  - Submit an activity with no partners, confirm no "with:" line appears.
  - As the owner, delete a recent (<7 days) activity from "My Activities" →
    confirm it disappears and points/leaderboard update.
  - As the owner, delete a recent activity from "Activities" tab (mixed
    among others) → same result.
  - Attempt to delete an activity older than 7 days → confirm rejected with
    the window-closed error message.
  - Confirm no delete button appears on other users' cards in "Activities".
  - Confirm cancelling the `confirm()` dialog leaves the activity untouched.
