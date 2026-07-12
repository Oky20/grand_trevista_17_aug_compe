# GTR Fest 17 — Fitness Challenge

Community fitness leaderboard with AI-powered activity submission. 6 teams, OCR via Gemini, streak-based scoring.

**Stack:** Vanilla HTML/JS · Supabase (Postgres + Edge Functions) · Gemini 2.5 Flash · Vercel

---

## Setup Guide

### 1. Get Gemini API Key
Go to [Google AI Studio](https://aistudio.google.com) → Get API Key → Copy key

### 2. Create Supabase Project
Go to [supabase.com](https://supabase.com) → New Project
- Copy **Project URL**, **anon key**, **service_role key**
- Open SQL Editor → run `supabase/schema.sql`

### 3. Deploy Edge Functions

**Step-by-step di terminal (PowerShell):**

```bash
# Install Supabase CLI (sekali aja)
npm install -g supabase

# Login ke Supabase (buka browser)
supabase login

# Link project (ganti YOUR_PROJECT_REF dgn ID project kamu)
# Bisa dicek di supabase.com/dashboard → Settings → General → Reference ID
supabase link --project-ref YOUR_PROJECT_REF

# Set Gemini API key (secret, aman di server)
supabase secrets set GEMINI_API_KEY=AIzaSy...

# Deploy 4 edge functions:
supabase functions deploy gemini-ocr
supabase functions deploy activity-submit
supabase functions deploy invite-code
supabase functions deploy admin-auth
```

> **Catatan:** Project Ref ID bisa kamu liat di Supabase Dashboard → Project Settings → General → Reference ID (misal: `cusjylwdeutawnbhhcpv`)

### 4. Configure the App
Edit `js/config.js` with your credentials:
```js
SUPABASE_URL:      'https://xxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...',
CHALLENGE_START:   '2026-04-01',
CHALLENGE_END:     '2026-04-30',
```

### 5. Deploy ke Vercel
```bash
# 1. Push semua perubahan ke GitHub
git add .
git commit -m "Migrasi Strava ke Gemini OCR"
git push

# 2. Buka vercel.com → Add New Project → Import repo ini
# 3. No build command, output directory kosongkan (static site)
# 4. Deploy → copy URL (misal: grand-trevista-17.vercel.app)
```

### 6. Admin Panel

Buka `<URL_VERCEL>/admin.html` di browser:
- Password default: **`admin123`** (ganti setelah login pertama)
- Fitur: Manual Entry, Manage Invite Codes, Review Submissions

**Cara ganti password admin:**
1. Generate SHA-256 hash dari password baru: buka [emn178.github.io/online-tools/sha256.html](https://emn178.github.io/online-tools/sha256.html)
2. Update di Supabase SQL Editor:
```sql
UPDATE admin_auth SET password_hash = 'hash_baru_kamu';
```

---

## File Structure
```
grand_trevista_17_aug_compe/
├── index.html                 ← Leaderboard + Submit + Register
├── admin.html                 ← Admin panel (manual entry, codes, review)
├── support.html               ← FAQ & help
├── js/
│   ├── config.js              ← App configuration
│   ├── api.js                 ← Supabase + OCR + Auth helpers
│   └── scoring.js             ← Scoring engine (pure functions)
└── supabase/
    ├── schema.sql             ← Database schema + seed data
    └── functions/
        ├── gemini-ocr/        ← OCR via Gemini 2.5 Flash
        ├── activity-submit/   ← Validate + insert activity
        ├── invite-code/       ← Validate code + register user
        └── admin-auth/        ← Admin login + code management
```

---

## How It Works

1. **Register** — User enters an invite code + name → assigned to team
2. **Submit** — Upload fitness app screenshot → Gemini OCR extracts stats
3. **Review** — User double-checks the AI-extracted data, edits if needed
4. **Confirm** — Activity saved to DB → leaderboard updates

---

## Scoring Rules

The engine (`js/scoring.js` + `js/config.js`) scores every activity under one of two rule sets, picked purely by the activity's own date (Jakarta time) — nothing here is retroactive:

- **Before `RULE_CUTOVER_DATE`** (currently `2026-07-13`, see `js/config.js`) — the original flat rules, `CONFIG.SCORING_LEGACY`. Unbounded per-activity bonuses, per-sport minimum duration, no calorie plausibility check.
- **From `RULE_CUTOVER_DATE` onward** — the current anti-abuse rules below, `CONFIG.SCORING`.

For the exact live numbers (they can be tuned without a redeploy of this doc), open the **Scoring Guide** tab in the app — it renders straight from `CONFIG.SCORING`, so it can't drift out of sync the way a hardcoded table here would.

### Always-on bonuses (same in both rule sets)

| Event | Pts |
|-------|-----|
| Valid activity | +10 |
| Elevation gain (Trail/Hike/Climb: /100m, Cycling: /200m, eBike: /300m) | +5 (+3 eBike) |
| Daily top calorie burner overall (across all athletes) | +5 |
| Streak M1 — day 3 | +10 |
| Streak M2 — day 6 | +20 |
| Streak M3 — day 9 | +30 |
| Streak M4+ — day 12+ | +40 |
| 30-day streak (one-time, on top of milestones) | +50 |
| Comeback bonus (first activity after 14+ days inactive) | +20 |
| Group activity (5+ people, same sport, within 60min, mutually tagged) | +20/person |

**Streak:** each milestone claimed once per challenge. Break = counter resets, claimed milestones kept. Max streak-milestone bonus = 100 pts (excludes the 30-day bonus).

### Rules from `2026-07-13` onward (anti-abuse)

These closed several gaps found in the original flat rules: unbounded bonuses from very long or very-high-calorie sessions, no plausibility check on reported calories (some fitness watches overestimate significantly), and no floor on pace/distance for walking or running.

- **Minimum duration:** flat 30 minutes for every sport (previously ranged 20–60 min per sport).
- **Calorie plausibility ceiling:** each sport has a min/max cal/min range, MET-derived from the [Compendium of Physical Activities](https://pacompendium.com/) (`cal/min ≈ MET × 1.225` at a 70kg reference). Below the minimum, the activity is rejected outright (not real exertion). Above the maximum, the activity stays valid but the calories used for scoring are clamped to the ceiling — the raw reported number is never altered or hidden, only the score is based on the clamped figure. See the Scoring Guide tab for the full per-sport table.
- **Daily diminishing returns:** duration, calorie, and distance bonuses are no longer computed per activity — they accumulate against a running total for that person on that calendar day, and each additional activity only earns the *marginal* bonus for pushing the total further. This stops one long session (or several split across a day) from earning unlimited bonus:
  - **Duration** (all sports combined): first 60 min/day free, then full rate, then half rate, then flat. Capped per day.
  - **Calories** (all sports combined, using the clamped/effective value): full rate, then half rate, then flat. Capped per day.
  - **Distance** (tracked separately per sport, since sports scale very differently): full rate up to 4× the sport's normal per-step distance, half rate to 8×, flat beyond.
- **Sport bonus decay:** for non-distance sports (gym, yoga, racket/team sports, martial arts, etc.), the flat sport bonus now decays across a person's non-distance activities that day — 1st full, 2nd about half, 3rd about a quarter, 4th+ nothing.
- **Pace & minimum distance floor** (Walking, Hiking, and Running variants only): each has a minimum distance and a slowest-allowed pace; failing either rejects the activity outright. Prevents "walking" a long duration without covering a plausible distance.
