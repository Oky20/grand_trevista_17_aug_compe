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

| Event | Pts |
|-------|-----|
| Valid activity (≥ min duration) | +10 |
| Per 250 kcal | +5 |
| Per 2.5 km | +5 |
| Per 30 min above 45 min | +5 |
| Daily top calorie burner overall | +5 |
| Streak M1 — day 3 | +10 |
| Streak M2 — day 6 | +20 |
| Streak M3 — day 9 | +30 |
| Streak M4+ — day 12+ | +40 |

**Streak:** each milestone claimed once per challenge. Break = counter resets, claimed milestones kept. Max streak bonus = 100 pts.
