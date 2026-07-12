# Design: Activity Cards (Companions, Self-Delete) & Team Activation Bonus

Date: 2026-07-12
Status: Approved

## Problem

On the "Activities" and "My Activities" tabs, activity cards don't show who
else joined the same session ("Training Partners" / companions), even though
that data is already collected at submission time. There's also no way for a
user to delete an activity they submitted by mistake or no longer want
counted. Separately, there's a new scoring rule to encourage teams to get a
critical mass of members active on the same weekday.

## Scope

Three independent, additive changes:

- **A & B** — user-facing app (`index.html` + `js/api.js` + a new Supabase
  Edge Function). No changes to `admin.html`.
- **C** — scoring engine only (`js/config.js` + `js/scoring.js`), plus a
  display-only badge addition to the same card templates touched in A.

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

## C. Team daily activation bonus (Mon–Thu, from 2026-07-13)

**Rule:** For each team, on each Monday–Thursday (Jakarta time) from
2026-07-13 onward, once at least `TEAM_ACTIVATION_MIN_USERS` (13) unique
members of that team each have at least one **valid** activity that day,
every one of those unique members earns `TEAM_ACTIVATION_BONUS` (+5) on
their own earliest valid activity of that day. This is a per-user bonus
(one +5 per qualifying user per day), not a single team-wide bonus — it's
gated on the team reaching the threshold, but paid out individually to
everyone who was part of reaching it.

**Threshold rationale:** Pulled actual per-team daily unique-active-user
counts from the DB (2026-07-01 through 2026-07-12, Mon–Thu only, `moving_time
>= 30min` as a validity proxy):

| Team | Members | Avg unique active/day | Median | Max ever |
|---|---|---|---|---|
| Zona 1 | 32 | 8.8 | 9 | 11 |
| Zona 2 | 7  | 2.3 | 2 | 3  |
| Zona 3 | 25 | 9.7 | 9 | 12 |
| Zona 4 | 22 | 9.7 | 11 | 14 |
| Zona 5 | 24 | 7.8 | 7 | 10 |
| Zona 6 | 17 | 6.3 | 6 | 8  |

A flat threshold of 13 was chosen deliberately as a stretch goal for every
team, confirmed with explicit awareness that **Zona 2 (7 total members) can
never mathematically reach it** under its current roster size — accepted as
intended (Zona 2 would only become eligible if its roster grows past 13 via
new invite-code registrations).

**Implementation:**

- **`js/config.js`** — add to `CONFIG.SCORING`:
  - `TEAM_ACTIVATION_MIN_USERS: 13`
  - `TEAM_ACTIVATION_BONUS: 5`
  - `TEAM_ACTIVATION_WEEKDAYS: [1, 2, 3, 4]` (Mon–Thu; `0` = Sunday, matching
    JS `Date.getDay()` convention)
  - `TEAM_ACTIVATION_START_DATE: '2026-07-13'` — kept as its own constant,
    intentionally decoupled from `RULE_CUTOVER_DATE` even though they
    currently share the same value, so a future unrelated change to the
    anti-abuse cutover date doesn't silently shift this feature's start date.
  - Add helper `jakartaWeekday(dateInput)` next to `jakartaDateKey`
    (`js/config.js:11-13`), returning the Jakarta-local day-of-week (0–6) via
    `Intl.DateTimeFormat` — avoids the UTC-midnight timezone pitfall of doing
    `new Date(dayKey).getDay()` on a bare `YYYY-MM-DD` string.

- **`js/scoring.js`** — new function `calcTeamActivationBonus(activities, users)`,
  structured like `calcGroupMatches` (`scoring.js:330-358`):
  1. Build a `user_id -> team_id` map from `users`.
  2. Filter `activities` to candidates: `jakartaDateKey(act.start_date) >=
     TEAM_ACTIVATION_START_DATE`, `jakartaWeekday(act.start_date)` is in
     `TEAM_ACTIVATION_WEEKDAYS`, and `isValidActivity(act).valid`.
  3. Group candidates by `(team_id, day)`.
  4. For each group where the count of distinct `user_id`s is
     `>= TEAM_ACTIVATION_MIN_USERS`: for every one of those users, find their
     earliest (by `start_date`) candidate activity that day and record
     `bonusByActId.set(activity.id, TEAM_ACTIVATION_BONUS)`.
  5. Return `bonusByActId` (`Map<activityId, number>`).

- Wire into `calcLeaderboard` (`scoring.js:395`, alongside
  `groupBonusByActId = calcGroupMatches(activities)`): compute
  `teamActivationByActId = calcTeamActivationBonus(activities, users)` once,
  then thread the per-activity value through to `calcActivityPointsNew` as a
  new parameter, stored as `breakdown.teamActivation` and added to `total`
  the same way `groupBonus` already is.
  - `calcActivityPointsLegacy` is untouched — this bonus only ever applies to
    dates on/after `TEAM_ACTIVATION_START_DATE`, so it never reaches the
    legacy path.

- **Display:** add a badge to the `bn[]` list in both `rActs()` and
  `rMyActs()` card templates (`index.html`), e.g.
  `if (bd.teamActivation) bn.push('+${bd.teamActivation} team activation')`,
  consistent with how `groupBonus`/`streak`/etc. already render.

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
  - With a test team seeded with 13 valid activities from 13 distinct users
    on a Monday on/after 2026-07-13, confirm each of those 13 users' earliest
    activity that day shows `+5 team activation` and it's added to their
    total points.
  - With only 12 distinct users active, confirm no one gets the bonus.
  - A user with 2 valid activities that day only gets the bonus on the
    earlier one, not both.
  - An activity on a Friday (or any non Mon–Thu day) never grants the bonus
    even with 13+ unique users active.
  - An activity dated before 2026-07-13 never grants the bonus.
  - Zona 2 (7 members) never shows the bonus under its current roster size.
