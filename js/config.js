// ============================================================
// GTR FEST 17 CONFIG
// Fill in your credentials before deploying
// ============================================================

// All "which day did this happen" logic (scoring day-buckets, streaks,
// activity list display, submission deadline) must agree on one timezone,
// regardless of the viewer's/server's own local timezone.
const TIMEZONE = 'Asia/Jakarta';

function jakartaDateKey(dateInput) {
  return new Date(dateInput).toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function jakartaWeekday(dateInput) {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short' }).format(new Date(dateInput));
  return WEEKDAY_INDEX[short];
}

// Distance bonus per sport: { per: km, bonus: points per step }
// Shared verbatim between legacy and current scoring — the per-km rates
// themselves never changed, only how many steps you're allowed to bank.
const DISTANCE_MAP = {
  // Running
  'Road Running':       { per: 2.5, bonus: 5 },
  'Trail Running':      { per: 2.5, bonus: 5 },
  'Track Running':      { per: 2.5, bonus: 5 },
  'Treadmill Running':  { per: 2.5, bonus: 5 },
  'Virtual Running':    { per: 2.5, bonus: 5 },
  // Cycling
  'Road Cycling':              { per: 10, bonus: 5 },
  'Mountain Biking (MTB)':     { per: 10, bonus: 5 },
  'Gravel Cycling':            { per: 10, bonus: 5 },
  'Indoor Cycling':            { per: 10, bonus: 5 },
  'eBike':                     { per: 15, bonus: 3 },
  // Swimming
  'Pool Swimming':       { per: 0.5, bonus: 5 },
  'Open Water Swimming': { per: 0.5, bonus: 5 },
  // Triathlon
  'Triathlon':           { per: 5, bonus: 5 },
  // Hiking & Outdoor
  'Hiking':   { per: 2.5, bonus: 5 },
  'Walking':  { per: 2.5, bonus: 5 },
  'Climbing': { per: 0, bonus: 0 },
  // Gym & Fitness
  'Strength Training': { per: 0, bonus: 0 },
  'HIIT':              { per: 0, bonus: 0 },
  'Cardio':            { per: 0, bonus: 0 },
  'Yoga':               { per: 0, bonus: 0 },
  'Pilates':           { per: 0, bonus: 0 },
  'Elliptical':        { per: 5, bonus: 5 },
  'Stair Stepper':     { per: 0, bonus: 0 },
  'Indoor Rowing':     { per: 2, bonus: 5 },
  // Paddling
  'Rowing': { per: 2, bonus: 5 },
  'Kayaking': { per: 2, bonus: 5 },
  'Stand-Up Paddleboarding (SUP)': { per: 2, bonus: 5 },
  // Racket Sports
  'Badminton':    { per: 0, bonus: 0 },
  'Tennis':       { per: 0, bonus: 0 },
  'Padel':        { per: 0, bonus: 0 },
  'Pickleball':   { per: 0, bonus: 0 },
  'Table Tennis': { per: 0, bonus: 0 },
  // Team Sports
  'Basketball':     { per: 0, bonus: 0 },
  'Volleyball':     { per: 0, bonus: 0 },
  'Soccer/Football': { per: 0, bonus: 0 },
  'Futsal':         { per: 0, bonus: 0 },
  // Martial Arts
  'Boxing':       { per: 0, bonus: 0 },
  'Martial Arts': { per: 0, bonus: 0 },
  // Golf
  'Golf': { per: 3, bonus: 5 },
  'DEFAULT': { per: 5, bonus: 5 },
};

// Distance ranking categories
const DISTANCE_CATEGORIES_LIST = [
  { key: 'all',   label: '🏃 Semua' },
  { key: 'foot',  label: '🏃 Lari & Jalan', sports: ['Road Running','Trail Running','Track Running','Treadmill Running','Virtual Running','Hiking','Walking'] },
  { key: 'cycle', label: '🚴 Sepeda', sports: ['Road Cycling','Mountain Biking (MTB)','Gravel Cycling','Indoor Cycling','eBike'] },
  { key: 'water', label: '🌊 Air', sports: ['Pool Swimming','Open Water Swimming','Rowing','Kayaking','Stand-Up Paddleboarding (SUP)','Indoor Rowing'] },
  { key: 'other', label: '🎯 Lainnya', sports: ['Triathlon','Elliptical','Golf'] },
];

// Elevation bonus per sport: { per: meters, bonus: points per step }
const ELEVATION_MAP = {
  'Trail Running':  { per: 100, bonus: 5 },
  'Hiking':         { per: 100, bonus: 5 },
  'Walking':        { per: 100, bonus: 5 },
  'Climbing':       { per: 100, bonus: 5 },
  'Road Cycling':              { per: 200, bonus: 5 },
  'Mountain Biking (MTB)':     { per: 200, bonus: 5 },
  'Gravel Cycling':            { per: 200, bonus: 5 },
  'eBike':                     { per: 300, bonus: 3 },
  'DEFAULT': { per: 0, bonus: 0 },
};

const CONFIG = {

  // --- Supabase ---
  SUPABASE_URL: 'https://cusjylwdeutawnbhhcpv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_QCHhsyVbnij44Da6x8Nl9w_ZBVRDQwW',

  // --- Challenge Period ---
  CHALLENGE_START: '2026-07-01',
  CHALLENGE_END:   '2026-08-14',
  CHALLENGE_NAME:  'GTR 17 Aug Fitness Challenge 2026',

  // --- Submission Window ---
  SUBMIT_WINDOW_DAYS: 7, // activity dated D can be submitted through D+7 (Jakarta time)

  // --- Anti-abuse rule cutover ---
  // Activities dated before this (Jakarta) score under SCORING_LEGACY, exactly as
  // they always have. Activities from this date forward score under SCORING below.
  // This exists so shipping tighter anti-abuse rules never silently rescores history.
  RULE_CUTOVER_DATE: '2026-07-13',

  // --- Teams ---
  TEAMS: [
    { id: 1, name: 'Zona 1',  color: '#FF6B6B', emoji: '🔴' },
    { id: 2, name: 'Zona 2',  color: '#4ECDC4', emoji: '🟢' },
    { id: 3, name: 'Zona 3',  color: '#FFE66D', emoji: '🟡' },
    { id: 4, name: 'Zona 4',  color: '#A78BFA', emoji: '🟣' },
    { id: 5, name: 'Zona 5',  color: '#F97316', emoji: '🟠' },
    { id: 6, name: 'Zona 6',  color: '#60A5FA', emoji: '🔵' },
  ],

  // --- Minimum Duration per Sport (in minutes) — LEGACY ONLY ---
  // Used only for activities dated before RULE_CUTOVER_DATE. Current activities
  // use the flat CONFIG.SCORING.MIN_DURATION instead (see below).
  MIN_DURATION: {
    // Running
    'Road Running':           20,
    'Trail Running':          30,
    'Track Running':          20,
    'Treadmill Running':      20,
    'Virtual Running':        20,
    // Cycling
    'Road Cycling':           30,
    'Mountain Biking (MTB)':  30,
    'Gravel Cycling':         30,
    'Indoor Cycling':         30,
    'eBike':                  30,
    // Swimming
    'Pool Swimming':          20,
    'Open Water Swimming':    20,
    // Triathlon & Multisport
    'Triathlon':              45,
    // Hiking & Outdoor
    'Hiking':                 30,
    'Walking':                20,
    'Climbing':                30,
    // Gym & Fitness
    'Strength Training':      30,
    'HIIT':                   20,
    'Cardio':                 20,
    'Yoga':                   30,
    'Pilates':                30,
    'Elliptical':             20,
    'Stair Stepper':          20,
    'Indoor Rowing':          20,
    // Paddling
    'Rowing':                 20,
    'Kayaking':               20,
    'Stand-Up Paddleboarding (SUP)': 20,
    // Racket Sports
    'Badminton':              30,
    'Tennis':                 30,
    'Padel':                  30,
    'Table Tennis':           30,
    // Team Sports
    'Basketball':             30,
    'Volleyball':             30,
    'Soccer/Football':        30,
    'Futsal':                 30,
    // Martial Arts
    'Boxing':                 30,
    'Martial Arts':           30,
    // Golf
    'Golf':                   30,
    'DEFAULT':                30,
  },

  // --- Scoring System — LEGACY ---
  // Exact values from before the 2026-07-13 anti-abuse rewrite, kept byte-for-byte
  // so activities dated before RULE_CUTOVER_DATE keep scoring exactly as they
  // always have. Do not "fix" values in here — that would silently rescore history.
  SCORING_LEGACY: {
    BASE_ACTIVITY:        10,
    CALORIES_PER:        250,
    CALORIES_BONUS:        5,
    DURATION_BASE:        45,
    DURATION_STEP:        30,
    DURATION_BONUS:        5,
    SPORT_BONUS:          15,
    MIN_CAL_PER_MIN:       3,
    DAILY_TOP_CALORIES:    5,
    STREAK_MILESTONES:  [10, 20, 30, 40],
    STREAK_BONUS_30_DAYS:   30,
    STREAK_BONUS_30_POINTS: 50,
    REACTIVATION_GAP_DAYS:  14,
    REACTIVATION_BONUS:     20,
    GROUP_MIN_SIZE:          5,
    GROUP_BONUS_PER_PERSON: 20,
    GROUP_TIME_WINDOW_MIN:  60,
    DISTANCE: DISTANCE_MAP,
    DISTANCE_CATEGORIES: DISTANCE_CATEGORIES_LIST,
    ELEVATION: ELEVATION_MAP,
  },

  // --- Scoring System — CURRENT (2026-07-13 onward) ---
  SCORING: {
    BASE_ACTIVITY:        10,
    MIN_DURATION:         30, // flat, replaces the per-sport legacy table above
    SPORT_BONUS:          15, // base value for non-distance sports; decays per same-day occurrence, see SPORT_BONUS_OCCURRENCE_CAP
    SPORT_BONUS_OCCURRENCE_CAP: 3, // 4th+ non-distance activity in a day earns 0
    DAILY_TOP_CALORIES:    5,
    STREAK_MILESTONES:  [10, 20, 30, 40],
    STREAK_BONUS_30_DAYS:   30,
    STREAK_BONUS_30_POINTS: 50,
    REACTIVATION_GAP_DAYS:  14,
    REACTIVATION_BONUS:     20,
    GROUP_MIN_SIZE:          5,
    GROUP_BONUS_PER_PERSON: 20,
    GROUP_TIME_WINDOW_MIN:  60,
    DISTANCE: DISTANCE_MAP,
    DISTANCE_CATEGORIES: DISTANCE_CATEGORIES_LIST,
    ELEVATION: ELEVATION_MAP,

    // Duration bonus: daily pool (combined across all sports), 60min free base/day,
    // then tiered — {upTo, step, bonus} in minutes-above-base.
    DURATION_BASE: 60,
    DURATION_TIERS: [
      { upTo: 120, step: 30, bonus: 5 },  // 60-180min raw: full rate, max +20
      { upTo: 240, step: 60, bonus: 5 },  // 180-300min raw: half rate, +10 more (cap +30)
    ],

    // Calorie bonus: daily pool (combined across all sports), no base, tiered
    // over each activity's EFFECTIVE (post cal/min-ceiling-clamped) calories.
    CALORIE_TIERS: [
      { upTo: 1000, step: 250, bonus: 5 },  // full rate, max +20
      { upTo: 2000, step: 500, bonus: 5 },  // half rate, +10 more (cap +30)
    ],

    // Calorie plausibility ceiling per sport: { min, max } cal/min. Below min = invalid
    // activity (reject). Above max = not rejected, just clamped for scoring purposes
    // (getEffectiveCalories). MET-derived from the Compendium of Physical Activities
    // (cal/min ≈ MET × 1.225 @ 70kg reference) — see README.md for full sourcing notes.
    CAL_PER_MIN: {
      // Running
      'Road Running': { min: 3, max: 17 }, 'Trail Running': { min: 3, max: 17 },
      'Track Running': { min: 3, max: 17 }, 'Treadmill Running': { min: 3, max: 17 },
      'Virtual Running': { min: 3, max: 17 },
      // Hiking & Walking
      'Walking': { min: 3, max: 9 },
      'Hiking': { min: 3, max: 10 },
      // Cycling
      'Road Cycling': { min: 3, max: 20 }, 'Mountain Biking (MTB)': { min: 3, max: 20 },
      'Gravel Cycling': { min: 3, max: 20 }, 'Indoor Cycling': { min: 3, max: 20 },
      'eBike': { min: 3, max: 9 },
      // Swimming
      'Pool Swimming': { min: 0, max: 13 }, 'Open Water Swimming': { min: 3, max: 13 },
      // Gym & Fitness
      'Elliptical': { min: 3, max: 7 },
      'Stair Stepper': { min: 3, max: 11 },
      'Indoor Rowing': { min: 3, max: 15 },
      'HIIT': { min: 3, max: 10 },
      'Cardio': { min: 3, max: 10 },
      'Strength Training': { min: 3, max: 7 },
      'Yoga': { min: 3, max: 5 },
      'Pilates': { min: 3, max: 5 },
      // Racket Sports
      'Tennis': { min: 3, max: 9 },
      'Badminton': { min: 3, max: 9 },
      'Pickleball': { min: 3, max: 9 },
      'Padel': { min: 3, max: 7 },
      'Table Tennis': { min: 3, max: 5 },
      // Team Sports
      'Basketball': { min: 3, max: 12 }, 'Volleyball': { min: 3, max: 12 },
      'Soccer/Football': { min: 3, max: 12 }, 'Futsal': { min: 3, max: 12 },
      // Martial Arts
      'Martial Arts': { min: 3, max: 15 }, 'Boxing': { min: 3, max: 15 },
      // Golf
      'Golf': { min: 3, max: 6 },
      // Multisport / Paddling
      'Triathlon': { min: 3, max: 15 }, 'Rowing': { min: 3, max: 15 },
      'Kayaking': { min: 3, max: 15 }, 'Stand-Up Paddleboarding (SUP)': { min: 3, max: 15 },
      'DEFAULT': { min: 3, max: 15 },
    },

    // Pace & minimum distance floor — foot-category sports only (Walking, Hiking,
    // Running variants). Fails either check => activity rejected outright (0 pts).
    PACE: {
      'Walking':           { minDistanceKm: 2.5, maxPaceMinPerKm: 18 },
      'Hiking':            { minDistanceKm: 2,   maxPaceMinPerKm: 25 },
      'Road Running':      { minDistanceKm: 2.5, maxPaceMinPerKm: 12 },
      'Track Running':     { minDistanceKm: 2.5, maxPaceMinPerKm: 12 },
      'Treadmill Running': { minDistanceKm: 2.5, maxPaceMinPerKm: 12 },
      'Virtual Running':   { minDistanceKm: 2.5, maxPaceMinPerKm: 12 },
      'Trail Running':     { minDistanceKm: 2.5, maxPaceMinPerKm: 15 },
    },

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

Object.freeze(CONFIG);
Object.freeze(CONFIG.SCORING_LEGACY);
Object.freeze(CONFIG.SCORING);
Object.freeze(CONFIG.SCORING.CAL_PER_MIN);
Object.freeze(CONFIG.SCORING.PACE);
Object.freeze(CONFIG.SCORING.TEAM_ACTIVATION_WEEKDAYS);
Object.freeze(CONFIG.SCORING.DURATION_TIERS);
Object.freeze(CONFIG.SCORING.CALORIE_TIERS);
Object.freeze(DISTANCE_MAP);
Object.freeze(DISTANCE_CATEGORIES_LIST);
Object.freeze(ELEVATION_MAP);
Object.freeze(CONFIG.MIN_DURATION);
