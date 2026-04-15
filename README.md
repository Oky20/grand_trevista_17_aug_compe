# 🏆 Fitness Challenge App

Strava-powered community fitness leaderboard — 6 teams, individual + team rankings, streak-based scoring.

**Stack:** Vanilla HTML/JS · Supabase (Postgres + Edge Functions) · Vercel

---

## Setup Guide

### 1. Create Strava App
Go to [strava.com/settings/api](https://www.strava.com/settings/api)
- Website: `http://localhost` (update after deploy)
- Callback domain: `localhost` (update after deploy)
- Copy **Client ID** and **Client Secret**

### 2. Create Supabase Project
Go to [supabase.com](https://supabase.com) → New Project
- Copy **Project URL**, **anon key**, **service_role key**
- Open SQL Editor → run `supabase/schema.sql`

### 3. Deploy Edge Functions
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase secrets set STRAVA_CLIENT_ID=your_id
supabase secrets set STRAVA_CLIENT_SECRET=your_secret
supabase secrets set CHALLENGE_START=2025-05-01

supabase functions deploy strava-auth
supabase functions deploy strava-sync
```

### 4. Configure the App
Edit `js/config.js` with your credentials:
```js
STRAVA_CLIENT_ID:  'xxxxxxx',
SUPABASE_URL:      'https://xxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...',
CHALLENGE_START:   '2025-05-01',
CHALLENGE_END:     '2025-05-31',
```

### 5. Deploy to Vercel
1. Push to GitHub
2. Vercel → New Project → Import repo (no build settings, it's static)
3. After deploy, update `STRAVA_REDIRECT_URI` in `config.js` to your Vercel URL
4. Update callback domain in Strava API settings
5. Redeploy

---

## File Structure
```
strava-challenge/
├── index.html                 ← Leaderboard (Overall / Teams / Individual)
├── callback.html              ← Strava OAuth handler + team picker
├── js/
│   ├── config.js              ← All settings (edit this!)
│   ├── scoring.js             ← Scoring engine
│   └── api.js                 ← Supabase + Strava helpers
└── supabase/
    ├── schema.sql             ← Run in Supabase SQL Editor
    └── functions/
        ├── strava-auth/       ← OAuth token exchange (keeps secret safe)
        └── strava-sync/       ← Pull & upsert Strava activities
```

---

## Scoring Rules

| Event | Pts |
|-------|-----|
| Valid activity (≥ min duration) | +10 |
| Per 500 kcal | +5 |
| Per 5 km | +5 |
| Per 30 min above 60 min | +5 |
| Daily top calorie burner in team | +5 |
| Streak Milestone 1 — day 3 | +10 |
| Streak Milestone 2 — day 6 | +20 |
| Streak Milestone 3 — day 9 | +30 |
| Streak Milestone 4+ — day 12+ | +40 |

**Streak:** each milestone claimed once per challenge. Break = counter resets, claimed milestones kept. Max streak bonus = 100 pts.
