# Activity Cards (Companions, Self-Delete) & Team Activation Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show training-partner names and a self-delete button on activity cards (Activities & My Activities tabs), and add a new "team activation" scoring bonus that pays +5 to every team member's first activity of the day once their team hits 13 unique active members on a Mon–Thu.

**Architecture:** Three additive, independently-testable slices on top of the existing vanilla HTML/JS + Supabase (Deno Edge Functions) app: (C) a pure-function scoring addition in `js/scoring.js`/`js/config.js`, wired into the existing `calcLeaderboard` pipeline; (A) a read-only rendering addition to the two card-template functions in `index.html`; (B) a new Supabase Edge Function (`activity-delete`) plus a matching `js/api.js` helper and a delete button wired into the same card templates.

**Tech Stack:** Vanilla JS (no framework, no bundler), Supabase Postgres + REST + Deno Edge Functions, no existing automated test suite.

## Global Constraints

- Timezone for all "which day is this" logic is `Asia/Jakarta` (`TIMEZONE` constant in `js/config.js`) — never use the raw UTC date.
- Team activation bonus: `TEAM_ACTIVATION_MIN_USERS = 13`, `TEAM_ACTIVATION_BONUS = 5`, applies only on Mon–Thu (`TEAM_ACTIVATION_WEEKDAYS = [1,2,3,4]`, 0=Sun), only from `TEAM_ACTIVATION_START_DATE = '2026-07-13'` onward, only counts/pays out on **valid** activities (`Scoring.isValidActivity(act).valid`).
- Deletion window: an activity can only be deleted by its owner within 7 days of its `start_date` (same `SUBMIT_WINDOW_DAYS` value as submission, re-declared locally in the new edge function).
- No new dependencies, frameworks, or build steps. This repo has no automated test suite — see each task's "Verify" step for the appropriate manual/throwaway-script approach given that constraint.
- Do not touch `admin.html` — none of this work applies there.

---

## Task 1: Config additions for the team activation bonus

**Files:**
- Modify: `js/config.js:11-13` (add `jakartaWeekday` helper after `jakartaDateKey`)
- Modify: `js/config.js:289-298` (add new `CONFIG.SCORING` keys after the `PACE` block)
- Modify: `js/config.js:301-311` (freeze the new array)

**Interfaces:**
- Produces: `function jakartaWeekday(dateInput)` → `number` (0=Sun..6=Sat, Jakarta-local day of week)
- Produces: `CONFIG.SCORING.TEAM_ACTIVATION_MIN_USERS` (`13`), `CONFIG.SCORING.TEAM_ACTIVATION_BONUS` (`5`), `CONFIG.SCORING.TEAM_ACTIVATION_WEEKDAYS` (`[1,2,3,4]`), `CONFIG.SCORING.TEAM_ACTIVATION_START_DATE` (`'2026-07-13'`)

- [ ] **Step 1: Create the throwaway verification harness at repo root**

This repo has no test framework. `js/config.js` and `js/scoring.js` are plain global-scope scripts (no `module.exports`), so we load them into a Node `vm` context to call their functions directly from a script — same values, zero new dependencies. This file is **never committed** (deleted at the end of Task 3).

Create `verify-scoring.js` in the repo root:

```js
// verify-scoring.js — throwaway manual verification harness, NOT committed.
// Run from the repo root: node verify-scoring.js
const fs = require('fs');
const vm = require('vm');

const sandbox = {};
vm.createContext(sandbox);
function load(relPath) {
  vm.runInContext(fs.readFileSync(relPath, 'utf8'), sandbox, { filename: relPath });
}
load('js/config.js');

const CONFIG = vm.runInContext('CONFIG', sandbox);
const jakartaWeekday = sandbox.jakartaWeekday; // function declarations attach directly to the vm context object

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else console.log('PASS:', msg);
}

assert(CONFIG.SCORING.TEAM_ACTIVATION_MIN_USERS === 13, 'TEAM_ACTIVATION_MIN_USERS is 13');
assert(CONFIG.SCORING.TEAM_ACTIVATION_BONUS === 5, 'TEAM_ACTIVATION_BONUS is 5');
assert(JSON.stringify(CONFIG.SCORING.TEAM_ACTIVATION_WEEKDAYS) === JSON.stringify([1, 2, 3, 4]), 'TEAM_ACTIVATION_WEEKDAYS is [1,2,3,4] (Mon-Thu)');
assert(CONFIG.SCORING.TEAM_ACTIVATION_START_DATE === '2026-07-13', 'TEAM_ACTIVATION_START_DATE is 2026-07-13');

assert(typeof jakartaWeekday === 'function', 'jakartaWeekday is defined');
if (typeof jakartaWeekday === 'function') {
  assert(jakartaWeekday('2026-07-13T02:00:00Z') === 1, 'jakartaWeekday: 2026-07-13T02:00Z (Mon 09:00 Jakarta) -> 1');
  assert(jakartaWeekday('2026-07-16T02:00:00Z') === 4, 'jakartaWeekday: 2026-07-16T02:00Z (Thu 09:00 Jakarta) -> 4');
  assert(jakartaWeekday('2026-07-17T02:00:00Z') === 5, 'jakartaWeekday: 2026-07-17T02:00Z (Fri 09:00 Jakarta) -> 5');
  assert(jakartaWeekday('2026-07-12T20:00:00Z') === 1, 'jakartaWeekday: 2026-07-12T20:00Z is 2026-07-13T03:00 Jakarta (Mon) -> 1');
}

console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `node verify-scoring.js`
Expected: every assertion prints `FAIL:` (config keys are `undefined`, `jakartaWeekday` is not a function), and the script prints `SOME CHECKS FAILED`.

- [ ] **Step 3: Add `jakartaWeekday` to `js/config.js`**

In `js/config.js`, immediately after the existing `jakartaDateKey` function (lines 11-13), add:

```js
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function jakartaWeekday(dateInput) {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(new Date(dateInput));
  return WEEKDAY_INDEX[short];
}
```

- [ ] **Step 4: Add the new `CONFIG.SCORING` keys**

In `js/config.js`, inside the `SCORING` object, immediately after the closing `},` of the `PACE` block (currently the last entry before `SCORING`'s own closing `},`, around line 297), add:

```js

    // Team daily activation bonus: once a team has this many distinct valid-active
    // members on the same Mon-Thu day (Jakarta) from TEAM_ACTIVATION_START_DATE
    // onward, every one of those members earns the bonus on their own earliest
    // valid activity that day.
    TEAM_ACTIVATION_MIN_USERS: 13,
    TEAM_ACTIVATION_BONUS: 5,
    TEAM_ACTIVATION_WEEKDAYS: [1, 2, 3, 4], // Mon-Thu (0 = Sun, matches Date.getDay())
    TEAM_ACTIVATION_START_DATE: '2026-07-13', // kept independent of RULE_CUTOVER_DATE on purpose
  },
};
```

(This replaces the previous closing `  },\n};` at the end of the `SCORING` object — the new keys go inside `SCORING`, right before its closing brace.)

- [ ] **Step 5: Freeze the new array alongside the other frozen arrays**

In `js/config.js`, in the block of `Object.freeze(...)` calls near the bottom (currently lines 301-311), add one line after `Object.freeze(CONFIG.SCORING.PACE);`:

```js
Object.freeze(CONFIG.SCORING.TEAM_ACTIVATION_WEEKDAYS);
```

- [ ] **Step 6: Run the harness again, confirm it passes**

Run: `node verify-scoring.js`
Expected: every line prints `PASS:`, ending with `ALL CHECKS PASSED`.

- [ ] **Step 7: Commit**

```bash
git add js/config.js
git commit -m "Add team activation bonus config and jakartaWeekday helper"
```

---

## Task 2: `calcTeamActivationBonus` in the scoring engine

**Files:**
- Modify: `js/scoring.js:330-358` (add new function immediately after `calcGroupMatches`)

**Interfaces:**
- Consumes: `CONFIG.SCORING.TEAM_ACTIVATION_*` (Task 1), `jakartaDateKey`/`jakartaWeekday` (`js/config.js`), `isValidActivity(activity)` (existing, `scoring.js:317-319`)
- Produces: `Scoring.calcTeamActivationBonus(activities, users)` → `Map<activityId, number>` — only contains entries for activities that were awarded the bonus; every value equals `CONFIG.SCORING.TEAM_ACTIVATION_BONUS`. `activities` is the full unfiltered activity list (same convention as `calcGroupMatches`); `users` is the full user list (each with `id`, `team_id`).

- [ ] **Step 1: Extend the verification harness**

Replace the contents of `verify-scoring.js` (still repo root, still not committed) with:

```js
// verify-scoring.js — throwaway manual verification harness, NOT committed.
// Run from the repo root: node verify-scoring.js
const fs = require('fs');
const vm = require('vm');

const sandbox = {};
vm.createContext(sandbox);
function load(relPath) {
  vm.runInContext(fs.readFileSync(relPath, 'utf8'), sandbox, { filename: relPath });
}
load('js/config.js');
load('js/scoring.js');

const CONFIG = vm.runInContext('CONFIG', sandbox);
const Scoring = vm.runInContext('Scoring', sandbox);

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else console.log('PASS:', msg);
}

function makeUser(id, team_id) { return { id, team_id }; }
function makeAct(id, user_id, start_date, overrides) {
  return Object.assign({
    id, user_id, start_date,
    sport_type: 'Strength Training', // no PACE requirement, calories=0 skips cal/min check
    moving_time: 1800, // exactly MIN_DURATION (30min), valid
    calories: 0,
    distance: 0,
    companions: [],
  }, overrides || {});
}

// --- calcTeamActivationBonus ---

{
  const users = [], activities = [];
  for (let i = 1; i <= 13; i++) {
    users.push(makeUser('u' + i, 1));
    activities.push(makeAct('a' + i, 'u' + i, '2026-07-13T02:00:00Z')); // Monday
  }
  const bonusMap = Scoring.calcTeamActivationBonus(activities, users);
  assert(bonusMap.size === 13, '13 distinct users active on a Monday -> 13 bonuses awarded');
  activities.forEach(a => assert(bonusMap.get(a.id) === CONFIG.SCORING.TEAM_ACTIVATION_BONUS, 'bonus amount correct for ' + a.id));
}

{
  const users = [], activities = [];
  for (let i = 1; i <= 12; i++) {
    users.push(makeUser('u' + i, 1));
    activities.push(makeAct('a' + i, 'u' + i, '2026-07-13T02:00:00Z'));
  }
  const bonusMap = Scoring.calcTeamActivationBonus(activities, users);
  assert(bonusMap.size === 0, '12 distinct users (below threshold) -> no bonuses');
}

{
  const users = [], activities = [];
  for (let i = 1; i <= 13; i++) {
    users.push(makeUser('u' + i, 1));
    activities.push(makeAct('a' + i, 'u' + i, '2026-07-17T02:00:00Z')); // Friday
  }
  const bonusMap = Scoring.calcTeamActivationBonus(activities, users);
  assert(bonusMap.size === 0, '13 users active on a Friday -> no bonus (not Mon-Thu)');
}

{
  const users = [], activities = [];
  for (let i = 1; i <= 13; i++) {
    users.push(makeUser('u' + i, 1));
    activities.push(makeAct('a' + i, 'u' + i, '2026-07-06T02:00:00Z')); // Monday, before start date
  }
  const bonusMap = Scoring.calcTeamActivationBonus(activities, users);
  assert(bonusMap.size === 0, 'activities before TEAM_ACTIVATION_START_DATE -> no bonus');
}

{
  const users = [], activities = [];
  for (let i = 1; i <= 13; i++) {
    users.push(makeUser('u' + i, 1));
    activities.push(makeAct('a' + i, 'u' + i, '2026-07-13T02:00:00Z'));
  }
  activities.push(makeAct('a1-late', 'u1', '2026-07-13T10:00:00Z')); // u1's 2nd activity that day, later
  const bonusMap = Scoring.calcTeamActivationBonus(activities, users);
  assert(bonusMap.has('a1') && !bonusMap.has('a1-late'), 'user with 2 valid activities that day only gets the bonus on the earlier one');
}

{
  const users = [], activities = [];
  for (let i = 1; i <= 12; i++) {
    users.push(makeUser('u' + i, 1));
    activities.push(makeAct('a' + i, 'u' + i, '2026-07-13T02:00:00Z'));
  }
  users.push(makeUser('u13', 1));
  activities.push(makeAct('a13', 'u13', '2026-07-13T02:00:00Z', { moving_time: 600 })); // 10min, invalid
  const bonusMap = Scoring.calcTeamActivationBonus(activities, users);
  assert(bonusMap.size === 0, 'an invalid (too-short) activity does not count toward the 13-user threshold');
}

console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `node verify-scoring.js`
Expected: a `TypeError: Scoring.calcTeamActivationBonus is not a function` (uncaught — the script will crash on the first `calcTeamActivationBonus` call, exiting non-zero).

- [ ] **Step 3: Implement `calcTeamActivationBonus`**

In `js/scoring.js`, immediately after the closing `}` of `calcGroupMatches` (currently ending at line 358, right before `function calcLeaderboard`), add:

```js
  // Once a team has >= TEAM_ACTIVATION_MIN_USERS distinct members with a valid
  // activity on the same Mon-Thu day (Jakarta, from TEAM_ACTIVATION_START_DATE
  // onward), every one of those members earns the bonus on their own earliest
  // valid activity that day.
  function calcTeamActivationBonus(activities, users) {
    const S = CONFIG.SCORING;
    const userTeam = {};
    users.forEach(u => { userTeam[u.id] = u.team_id; });

    const candidates = activities.filter(act =>
      jakartaDateKey(act.start_date) >= S.TEAM_ACTIVATION_START_DATE &&
      S.TEAM_ACTIVATION_WEEKDAYS.includes(jakartaWeekday(act.start_date)) &&
      isValidActivity(act).valid
    );

    // `${team_id}|${day}` -> Map<user_id, earliest candidate activity that day>
    const groups = new Map();
    candidates.forEach(act => {
      const team = userTeam[act.user_id];
      if (team == null) return;
      const key = team + '|' + jakartaDateKey(act.start_date);
      if (!groups.has(key)) groups.set(key, new Map());
      const byUser = groups.get(key);
      const existing = byUser.get(act.user_id);
      if (!existing || new Date(act.start_date) < new Date(existing.start_date)) {
        byUser.set(act.user_id, act);
      }
    });

    const bonusByActId = new Map();
    groups.forEach(byUser => {
      if (byUser.size < S.TEAM_ACTIVATION_MIN_USERS) return;
      byUser.forEach(act => bonusByActId.set(act.id, S.TEAM_ACTIVATION_BONUS));
    });

    return bonusByActId;
  }

```

Then update the module's public return statement (currently `return { calcLeaderboard, calcTeamStats, calcActivityPoints, isValidActivity, getMinDuration, isLegacyActivity, getEffectiveCalories, tieredBonus, nonDistanceSportBonus };`) to also export it:

```js
  return { calcLeaderboard, calcTeamStats, calcActivityPoints, isValidActivity, getMinDuration, isLegacyActivity, getEffectiveCalories, tieredBonus, nonDistanceSportBonus, calcTeamActivationBonus };
```

- [ ] **Step 4: Run the harness again, confirm it passes**

Run: `node verify-scoring.js`
Expected: every line prints `PASS:`, ending with `ALL CHECKS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add js/scoring.js
git commit -m "Add calcTeamActivationBonus to the scoring engine"
```

---

## Task 3: Wire the team activation bonus into scoring + leaderboard totals

**Files:**
- Modify: `js/scoring.js:215` (`calcActivityPointsNew` signature)
- Modify: `js/scoring.js:304-311` (breakdown/total accumulation, near `groupBonus`)
- Modify: `js/scoring.js:321-325` (`calcActivityPoints` dispatcher)
- Modify: `js/scoring.js:395` (`calcLeaderboard` — compute the bonus map once)
- Modify: `js/scoring.js:465-469` (`calcLeaderboard` — pass the per-activity bonus into `calcActivityPoints`)

**Interfaces:**
- Consumes: `Scoring.calcTeamActivationBonus` (Task 2)
- Produces: `calcActivityPointsNew(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus, poolContext, teamActivationBonus)` (7th param, defaults not needed — always passed by its only caller); `calcActivityPoints(..., teamActivationBonus = 0)` (dispatcher, same new param, legacy path ignores it); every activity object in `Scoring.calcLeaderboard(...)[].activities[]` now carries `breakdown.teamActivation` (`number`, `0` when not awarded).

- [ ] **Step 1: Extend the verification harness with a leaderboard-level check**

Append this block to `verify-scoring.js` (before the final `console.log(process.exitCode ? ...)` line):

```js
// --- calcLeaderboard wiring ---

{
  const users = [], activities = [];
  for (let i = 1; i <= 13; i++) {
    users.push(makeUser('u' + i, 1));
    activities.push(makeAct('a' + i, 'u' + i, '2026-07-13T02:00:00Z'));
  }
  const leaderboard = Scoring.calcLeaderboard(users, activities, '2026-07-01', '2026-08-14');
  const u1 = leaderboard.find(m => m.id === 'u1');
  const u1act = u1.activities.find(a => a.id === 'a1');
  assert(u1act.breakdown.teamActivation === CONFIG.SCORING.TEAM_ACTIVATION_BONUS, 'calcLeaderboard: qualifying activity breakdown.teamActivation is set');
  assert(u1act.points >= CONFIG.SCORING.TEAM_ACTIVATION_BONUS, 'calcLeaderboard: teamActivation bonus is included in the activity points total');
}

{
  const users = [], activities = [];
  for (let i = 1; i <= 12; i++) {
    users.push(makeUser('u' + i, 1));
    activities.push(makeAct('a' + i, 'u' + i, '2026-07-13T02:00:00Z'));
  }
  const leaderboard = Scoring.calcLeaderboard(users, activities, '2026-07-01', '2026-08-14');
  const u1 = leaderboard.find(m => m.id === 'u1');
  const u1act = u1.activities.find(a => a.id === 'a1');
  assert(u1act.breakdown.teamActivation === 0, 'calcLeaderboard: below-threshold day -> breakdown.teamActivation is 0');
}
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `node verify-scoring.js`
Expected: `FAIL: calcLeaderboard: qualifying activity breakdown.teamActivation is set` (currently `undefined`, not `5`), and the second new assertion may pass coincidentally (`undefined === 0` is false, so it should also `FAIL`). Overall: `SOME CHECKS FAILED`.

- [ ] **Step 3: Thread `teamActivationBonus` through `calcActivityPointsNew`**

In `js/scoring.js`, change the `calcActivityPointsNew` signature (currently line 215):

```js
  function calcActivityPointsNew(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus, poolContext) {
```

to:

```js
  function calcActivityPointsNew(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus, poolContext, teamActivationBonus) {
```

Then, immediately after the existing `breakdown.groupBonus = groupBonus || 0; total += breakdown.groupBonus;` lines (currently lines 307-308), add:

```js

    breakdown.teamActivation = teamActivationBonus || 0;
    total += breakdown.teamActivation;
```

- [ ] **Step 4: Thread it through the `calcActivityPoints` dispatcher**

Change the dispatcher (currently lines 321-325):

```js
  function calcActivityPoints(activity, streakContext = null, isDailyTopCalories = false, isReactivation = false, groupBonus = 0, poolContext = null) {
    return isLegacyActivity(activity)
      ? calcActivityPointsLegacy(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus)
      : calcActivityPointsNew(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus, poolContext);
  }
```

to:

```js
  function calcActivityPoints(activity, streakContext = null, isDailyTopCalories = false, isReactivation = false, groupBonus = 0, poolContext = null, teamActivationBonus = 0) {
    return isLegacyActivity(activity)
      ? calcActivityPointsLegacy(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus)
      : calcActivityPointsNew(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus, poolContext, teamActivationBonus);
  }
```

(The legacy path intentionally never receives `teamActivationBonus` — this bonus only ever applies on/after `TEAM_ACTIVATION_START_DATE`, which is on the current-rules side of `RULE_CUTOVER_DATE`.)

- [ ] **Step 5: Compute the bonus map once in `calcLeaderboard` and pass it through**

In `js/scoring.js`, in `calcLeaderboard`, right after the existing line (currently line 395):

```js
    const groupBonusByActId = calcGroupMatches(activities);
```

add:

```js
    const teamActivationByActId = calcTeamActivationBonus(activities, users);
```

Then find the `calcActivityPoints(...)` call inside the `sorted.forEach(act => { ... })` loop (currently lines 465-469):

```js
      const result = calcActivityPoints(act, {
        currentStreak: streakMap[act.user_id] || 0,
        claimedMilestones: m.claimedMilestones,
        claimedStreak30: m.claimedStreak30,
      }, isDailyTop, isReactivation, groupBonusByActId.get(act.id) || 0, poolContext);
```

and change its final argument line to:

```js
      const result = calcActivityPoints(act, {
        currentStreak: streakMap[act.user_id] || 0,
        claimedMilestones: m.claimedMilestones,
        claimedStreak30: m.claimedStreak30,
      }, isDailyTop, isReactivation, groupBonusByActId.get(act.id) || 0, poolContext, teamActivationByActId.get(act.id) || 0);
```

- [ ] **Step 6: Run the harness again, confirm it passes, then delete it**

Run: `node verify-scoring.js`
Expected: every line prints `PASS:`, ending with `ALL CHECKS PASSED`.

Then remove the throwaway harness — it must not be committed:

```bash
rm verify-scoring.js
```

- [ ] **Step 7: Commit**

```bash
git add js/scoring.js
git commit -m "Wire team activation bonus into calcActivityPoints and calcLeaderboard"
```

---

## Task 4: Show the team activation badge on activity cards

**Files:**
- Modify: `index.html:638` (`rActs()` badge list)
- Modify: `index.html:712` (`rMyActs()` badge list)

**Interfaces:**
- Consumes: `bd.teamActivation` (from `breakdown.teamActivation`, Task 3) on each activity object rendered by `rActs()`/`rMyActs()`.
- Produces: no new interface — display only.

- [ ] **Step 1: Add the badge line to `rActs()`**

In `index.html`, inside `rActs()`, find this line (currently line 638):

```js
    if (bd.streak30) bn.push(`+${bd.streak30} 30-day streak`); if (bd.reactivation) bn.push(`+${bd.reactivation} comeback`); if (bd.groupBonus) bn.push(`+${bd.groupBonus} group`);
```

and change it to:

```js
    if (bd.streak30) bn.push(`+${bd.streak30} 30-day streak`); if (bd.reactivation) bn.push(`+${bd.reactivation} comeback`); if (bd.groupBonus) bn.push(`+${bd.groupBonus} group`);
    if (bd.teamActivation) bn.push(`+${bd.teamActivation} team activation`);
```

- [ ] **Step 2: Add the same badge line to `rMyActs()`**

In `index.html`, inside `rMyActs()`, find this line (currently line 712):

```js
    if (bd.groupBonus) bn.push(`+${bd.groupBonus} group`);
```

and change it to:

```js
    if (bd.groupBonus) bn.push(`+${bd.groupBonus} group`);
    if (bd.teamActivation) bn.push(`+${bd.teamActivation} team activation`);
```

- [ ] **Step 3: Manually verify in the browser**

There's no browser test runner in this repo, so verify by temporarily lowering the threshold and reloading:

1. Start a local static server from the repo root (e.g. `python -m http.server 8000`) and open `http://localhost:8000/index.html`.
2. Temporarily edit `js/config.js` and set `TEAM_ACTIVATION_MIN_USERS: 1` (just for this manual check).
3. Log in (or register) as a test user, submit an activity dated a Monday–Thursday on/after `2026-07-13` (e.g. `2026-07-13`).
4. Go to "My Activities" and "Activities" tabs — confirm the card shows a `+5 team activation` badge.
5. Revert `js/config.js` back to `TEAM_ACTIVATION_MIN_USERS: 13`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Show team activation bonus badge on activity cards"
```

---

## Task 5: Show companion (training partner) names on activity cards

**Files:**
- Modify: `index.html:613` (add shared helper function, right before `rActs()`)
- Modify: `index.html:645` (`rActs()` card template)
- Modify: `index.html:721` (`rMyActs()` card template)
- Modify: `index.html` `<style>` block, near line 90 (`.adate` rule) — add `.awith` rule

**Interfaces:**
- Consumes: `a.companions` (`string[]` of user IDs, already present on every activity object returned from the DB — no backend change needed), the global `LB` array (`{id, name, ...}[]`, already populated by `loadData()`).
- Produces: `function companionNamesLine(a)` → HTML string (empty string if no companions), used by both `rActs()` and `rMyActs()`.

- [ ] **Step 1: Add the shared helper function**

In `index.html`, immediately before `function rActs() {` (currently line 614), add:

```js
function companionNamesLine(a) {
  if (!Array.isArray(a.companions) || !a.companions.length) return '';
  const names = a.companions.map(id => { const m = LB.find(x => x.id === id); return m ? m.name : null; }).filter(Boolean);
  if (!names.length) return '';
  return `<div class="awith">🤝 with: ${names.join(', ')}</div>`;
}

```

- [ ] **Step 2: Add the CSS rule**

In `index.html`'s `<style>` block, immediately after the existing `.adate` rule (currently line 90):

```css
.adate{font-size:11px;color:var(--dim);font-family:var(--mono);margin-top:2px;}
```

add:

```css
.awith{font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:2px;}
```

- [ ] **Step 3: Render it in `rActs()`**

In `index.html`, inside `rActs()`'s card template, find:

```js
        <div class="adate">${date} · ${a.sport_type}</div>
        <div class="astats">
```

and change it to:

```js
        <div class="adate">${date} · ${a.sport_type}</div>
        ${companionNamesLine(a)}
        <div class="astats">
```

- [ ] **Step 4: Render it in `rMyActs()`**

In `index.html`, inside `rMyActs()`'s card template, find the same pattern:

```js
        <div class="adate">${date} · ${a.sport_type}</div>
        <div class="astats">
```

and change it to:

```js
        <div class="adate">${date} · ${a.sport_type}</div>
        ${companionNamesLine(a)}
        <div class="astats">
```

(This exact string appears once in each function's template literal — `rActs()`'s copy and `rMyActs()`'s copy — make the edit in both places, not with a single find-and-replace-all across the file.)

- [ ] **Step 5: Manually verify in the browser**

1. Start a local static server (`python -m http.server 8000`) and open `http://localhost:8000/index.html`.
2. Log in, go to "Submit Activity", fill the form, and pick 2+ Training Partners before confirming.
3. Check "My Activities" — the new card should show `🤝 with: <name1>, <name2>` under the date line.
4. Check the "Activities" tab (with no athlete filter) — the same card should show the same line.
5. Submit a second activity with no training partners — confirm no "with:" line appears on that card in either tab.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Show training partner names on activity cards"
```

---

## Task 6: `activity-delete` Supabase Edge Function

**Files:**
- Create: `supabase/functions/activity-delete/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone backend endpoint).
- Produces: `POST ${CONFIG.SUPABASE_URL}/functions/v1/activity-delete` with body `{ activity_id: string, user_id: string }`, returning `{ success: true }` (200) or `{ error: string }` (400/403/404/500).

- [ ] **Step 1: Write the function**

Create `supabase/functions/activity-delete/index.ts`:

```ts
// supabase/functions/activity-delete/index.ts
// Deletes an activity after verifying the requester owns it and it's within
// the deletion window. Mirrors activity-submit's trust model: the client
// sends user_id, but ownership is verified server-side against the DB.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const TIMEZONE = "Asia/Jakarta";
const DELETE_WINDOW_DAYS = 7; // same window as activity-submit's SUBMIT_WINDOW_DAYS

function jakartaDateKey(dateInput: string | number | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(dateInput));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { activity_id, user_id } = body;

    if (!activity_id) return json({ error: "Missing activity_id" }, 400);
    if (!user_id) return json({ error: "Missing user_id" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: activity, error: fetchError } = await sb
      .from("activities")
      .select("id, user_id, start_date")
      .eq("id", activity_id)
      .single();

    if (fetchError || !activity) return json({ error: "Activity not found" }, 404);
    if (activity.user_id !== user_id) {
      return json({ error: "You can only delete your own activities." }, 403);
    }

    const activityDay = jakartaDateKey(activity.start_date);
    const todayDay = jakartaDateKey(new Date());
    const daysSince = (Date.parse(todayDay) - Date.parse(activityDay)) / 86400000;
    if (daysSince > DELETE_WINDOW_DAYS) {
      return json({ error: `Deletion window closed — activities can only be deleted within ${DELETE_WINDOW_DAYS} days of the activity date.` }, 400);
    }

    const { error: deleteError } = await sb
      .from("activities")
      .delete()
      .eq("id", activity_id);

    if (deleteError) return json({ error: deleteError.message }, 500);

    return json({ success: true });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
```

- [ ] **Step 2: Deploy and verify manually**

This is a Deno Edge Function — it cannot be run or unit-tested with Node. Deploy it (same flow as the other functions, documented in `README.md`):

```bash
supabase functions deploy activity-delete
```

Then verify with curl (replace `<SUPABASE_URL>`, `<ANON_KEY>`, and the IDs with real values from your Supabase project — e.g. copy them out of `js/config.js` and from an activity row you own):

```bash
# Missing fields -> 400
curl -s -X POST "<SUPABASE_URL>/functions/v1/activity-delete" \
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{}'
# Expect: {"error":"Missing activity_id"}

# Wrong owner -> 403
curl -s -X POST "<SUPABASE_URL>/functions/v1/activity-delete" \
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"activity_id":"<REAL_ACTIVITY_ID>","user_id":"<A_DIFFERENT_USER_ID>"}'
# Expect: {"error":"You can only delete your own activities."}

# Real owner, activity within 7 days -> success
curl -s -X POST "<SUPABASE_URL>/functions/v1/activity-delete" \
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"activity_id":"<REAL_ACTIVITY_ID>","user_id":"<ITS_ACTUAL_OWNER_ID>"}'
# Expect: {"success":true} — then confirm the row is gone via the Supabase table editor or a GET on activities?id=eq.<REAL_ACTIVITY_ID>
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/activity-delete/index.ts
git commit -m "Add activity-delete edge function"
```

---

## Task 7: `Activity.delete()` API helper

**Files:**
- Modify: `js/api.js:154` (add new `Activity` object, right before the `// -- SESSION --` section)

**Interfaces:**
- Consumes: `activity-delete` edge function (Task 6), `CONFIG.SUPABASE_URL`/`CONFIG.SUPABASE_ANON_KEY`, `Session.get()` (existing, `js/api.js:157-159`).
- Produces: `Activity.delete(activityId)` → `Promise<{success: true}>`, rejects with `Error(message)` on failure (same shape as `OCR.submitActivity`).

- [ ] **Step 1: Add the `Activity` object**

In `js/api.js`, immediately before the `// -- SESSION --------------------------------------------------` comment (currently line 154), add:

```js
// -- ACTIVITY (Self-service delete) ----------------------------

const Activity = {
  async delete(activityId) {
    const u = Session.get();
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/activity-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ activity_id: activityId, user_id: u ? u.id : null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete activity.');
    }
    return res.json();
  },
};

```

Note: this references `Session.get()`, which is declared further down in the same file (`js/api.js:156-166` before this edit). Since `Session` is declared with `const` at the top level of a classic (non-module) script, and `Activity.delete` only calls `Session.get()` *inside* an async function body (evaluated lazily, not at parse/declaration time), this works regardless of declaration order in the file — but for readability, keep `Activity` positioned right before the `SESSION` section as shown above, so a reader encounters `Session` right after.

- [ ] **Step 2: Manually verify in the browser console**

1. Start a local static server (`python -m http.server 8000`), open `http://localhost:8000/index.html`, and log in as a test user.
2. Submit a test activity via the Submit tab.
3. Open the browser devtools console and find the new activity's `id` (e.g. via `LB.find(m => m.id === Session.get().id).activities[0].id`).
4. Run: `Activity.delete('<that-id>').then(console.log).catch(console.error)`.
5. Expect the console to log `{success: true}`, and confirm the activity is gone after calling `loadData()` and re-checking `LB`.
6. Run it again with the same (now-deleted) id and confirm it logs an `Error: Activity not found`.

- [ ] **Step 3: Commit**

```bash
git add js/api.js
git commit -m "Add Activity.delete() API helper"
```

---

## Task 8: Delete button on activity cards

**Files:**
- Modify: `index.html` `<style>` block, near line 95 (`.apts` rule) — add `.adel` rule
- Modify: `index.html:613` area — add `deleteBtn(a)` helper and `handleDeleteActivity(activityId)` handler, next to `companionNamesLine`
- Modify: `index.html:655` (`rActs()` — `.apts` div in the card template)
- Modify: `index.html:731` (`rMyActs()` — `.apts` div in the card template)

**Interfaces:**
- Consumes: `Activity.delete(activityId)` (Task 7), `Session.get()`, `toast(msg, type)` (existing, `index.html:1097`), `loadData()` (existing, `index.html:356-370`), `a.user_id`/`a.id` (already present on every activity object).
- Produces: `function deleteBtn(a)` → HTML string (empty if not the owner's own activity), `function handleDeleteActivity(activityId)` global click handler.

- [ ] **Step 1: Add the CSS rule**

In `index.html`'s `<style>` block, immediately after the existing `.apts` rule (currently line 95):

```css
.apts{text-align:right;flex-shrink:0;}.apv{font-size:20px;font-weight:600;color:var(--orange);}.apl{font-size:10px;color:var(--dim);font-family:var(--mono);}
```

add:

```css
.adel{cursor:pointer;font-size:13px;opacity:.35;transition:opacity .15s;margin-bottom:6px;}
.adel:hover{opacity:1;}
```

- [ ] **Step 2: Add the helper and click handler**

In `index.html`, immediately after the `companionNamesLine` function added in Task 5 (still right before `function rActs() {`), add:

```js
function deleteBtn(a) {
  const u = Session.get();
  if (!u || a.user_id !== u.id) return '';
  return `<div class="adel" title="Delete activity" onclick="handleDeleteActivity('${a.id}')">🗑</div>`;
}

async function handleDeleteActivity(activityId) {
  if (!window.confirm('Delete this activity? This cannot be undone and will remove its points.')) return;
  try {
    await Activity.delete(activityId);
    toast('Activity deleted', 'success');
    loadData();
  } catch (e) {
    toast(e.message || 'Failed to delete activity.', 'error');
  }
}

```

- [ ] **Step 3: Render the button in `rActs()`**

In `index.html`, inside `rActs()`'s card template, find:

```js
      <div class="apts"><div class="apv">${pts}</div><div class="apl">pts</div></div>
```

and change it to:

```js
      <div class="apts">${deleteBtn(a)}<div class="apv">${pts}</div><div class="apl">pts</div></div>
```

- [ ] **Step 4: Render the button in `rMyActs()`**

In `index.html`, inside `rMyActs()`'s card template, find the same pattern:

```js
      <div class="apts"><div class="apv">${pts}</div><div class="apl">pts</div></div>
```

and change it to:

```js
      <div class="apts">${deleteBtn(a)}<div class="apv">${pts}</div><div class="apl">pts</div></div>
```

(Same note as Task 5 Step 4 — this string appears once per function; edit both occurrences individually.)

- [ ] **Step 5: Manually verify in the browser**

1. Start a local static server (`python -m http.server 8000`), open `http://localhost:8000/index.html`, log in as a test user.
2. Submit a fresh activity (dated today).
3. On "My Activities", confirm a small 🗑 appears on your own card (low-opacity, brightens on hover), positioned above the points.
4. Click it, then click "Cancel" on the confirm dialog — confirm the card is still there and unchanged.
5. Click it again, click "OK" — confirm a success toast appears, the card disappears, and your point total updates.
6. Go to "Activities" (all users) — confirm you don't see a 🗑 on any other user's card, only ones matching your own `user_id` (if you have another still-existing activity there).
7. Try deleting an activity older than 7 days (submit one with a manually-set old `start_date` if needed, or use `Activity.delete()` directly from the console against an old activity's id) — confirm the error toast shows the "Deletion window closed" message and the activity remains.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Add self-delete button to activity cards"
```

---

## Self-Review Notes

- **Spec coverage:** Part A (companion names) → Task 5. Part B (self-delete) → Tasks 6–8. Part C (team activation bonus) → Tasks 1–4. All three spec sections have corresponding tasks.
- **Placeholder scan:** No TBD/TODO markers; every step has literal, complete code.
- **Type/name consistency checked:** `jakartaWeekday`, `CONFIG.SCORING.TEAM_ACTIVATION_*`, `Scoring.calcTeamActivationBonus`, `breakdown.teamActivation`, `companionNamesLine`, `deleteBtn`, `handleDeleteActivity`, and `Activity.delete` are each defined once and referenced with the same name/signature in every task that consumes them.
