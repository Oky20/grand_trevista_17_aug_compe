// ============================================================
// STRAVA CHALLENGE CONFIG
// Fill in your credentials before deploying
// ============================================================

const CONFIG = {
  // --- Strava App ---
  STRAVA_CLIENT_ID: '225527',
  STRAVA_REDIRECT_URI: 'https://grand-trevista-17-aug-competition.vercel.app/callback.html', // update after deploy

  // --- Supabase ---
  SUPABASE_URL: 'https://cusjylwdeutawnbhhcpv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_QCHhsyVbnij44Da6x8Nl9w_ZBVRDQwW',

  // --- Challenge Period ---
  CHALLENGE_START: '2026-04-01', // YYYY-MM-DD
  CHALLENGE_END:   '2026-04-30',
  CHALLENGE_NAME:  'GTR 17 Aug Fitness Challenge 2025',

  // --- Teams ---
  TEAMS: [
    { id: 1, name: 'Zona 1',   color: '#FF6B6B', emoji: '🔴' },
    { id: 2, name: 'Zona 2',    color: '#4ECDC4', emoji: '🟢' },
    { id: 3, name: 'Zona 3',   color: '#FFE66D', emoji: '🟡' },
    { id: 4, name: 'Zona 4',   color: '#A78BFA', emoji: '🟣' },
    { id: 5, name: 'Zona 5', color: '#F97316', emoji: '🟠' },
    { id: 6, name: 'Zona 6',    color: '#60A5FA', emoji: '🔵' },
  ],

  // --- Minimum Duration per Sport (in minutes) ---
  MIN_DURATION: {
    'Run':          20,
    'Walk':         20,
    'Ride':         30,
    'VirtualRide':  30,
    'Swim':         20,
    'Padel':        45,
    'Tennis':       45,
    'Badminton':    30,
    'WeightTraining': 30,
    'Workout':      30,
    'Yoga':         30,
    'Pilates':      30,
    'Hike':         30,
    'DEFAULT':      30,
  },
 
  // --- Scoring System ---
  SCORING: {
    BASE_ACTIVITY:        10,   // per valid activity
    CALORIES_PER:        250,   // every X calories
    CALORIES_BONUS:        5,   // points per threshold
    DISTANCE_PER:        2.5,   // every X km
    DISTANCE_BONUS:        5,   // points per threshold
    DURATION_BASE:        30,   // minutes before bonus starts
    DURATION_STEP:        30,   // every X minutes above base
    DURATION_BONUS:        5,   // points per step
    MIN_CAL_PER_MIN:       4,   // min calories/minute for valid activity (skipped if calories=0)
    DAILY_TOP_CALORIES:    5,   // bonus for top calorie burner of the day — overall all athletes
    STREAK_MILESTONES:  [10, 20, 30, 40], // poin per milestone (index 0=M1, 1=M2, etc), M4+ flat at 40
  },
};
 
// Freeze config so it can't be mutated
Object.freeze(CONFIG);
Object.freeze(CONFIG.SCORING);
Object.freeze(CONFIG.MIN_DURATION);
 
