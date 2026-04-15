// ============================================================
// STRAVA CHALLENGE CONFIG
// Fill in your credentials before deploying
// ============================================================

const CONFIG = {
  // --- Strava App ---
  STRAVA_CLIENT_ID: '225527',
  STRAVA_REDIRECT_URI: 'https://YOUR_VERCEL_URL/callback.html', // update after deploy

  // --- Supabase ---
  SUPABASE_URL: 'https://cusjylwdeutawnbhhcpv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_QCHhsyVbnij44Da6x8Nl9w_ZBVRDQwW',

  // --- Challenge Period ---
  CHALLENGE_START: '2025-05-01', // YYYY-MM-DD
  CHALLENGE_END:   '2025-05-31',
  CHALLENGE_NAME:  'May Fitness Challenge 2025',

  // --- Teams ---
  TEAMS: [
    { id: 1, name: 'Team Alpha',   color: '#FF6B6B', emoji: '🔴' },
    { id: 2, name: 'Team Beta',    color: '#4ECDC4', emoji: '🟢' },
    { id: 3, name: 'Team Gamma',   color: '#FFE66D', emoji: '🟡' },
    { id: 4, name: 'Team Delta',   color: '#A78BFA', emoji: '🟣' },
    { id: 5, name: 'Team Epsilon', color: '#F97316', emoji: '🟠' },
    { id: 6, name: 'Team Zeta',    color: '#60A5FA', emoji: '🔵' },
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
    CALORIES_PER:        500,   // every X calories
    CALORIES_BONUS:        5,   // points per threshold
    DISTANCE_PER:          5,   // every X km
    DISTANCE_BONUS:        5,   // points per threshold
    DURATION_BASE:        60,   // minutes before bonus starts
    DURATION_STEP:        30,   // every X minutes above base
    DURATION_BONUS:        5,   // points per step
    DAILY_TOP_CALORIES:    5,   // bonus for top calorie burner of the day in group
    STREAK_MILESTONES:  [10, 20, 30, 40], // poin per milestone (index 0=M1, 1=M2, etc), M4+ flat at 40
  },
};

// Freeze config so it can't be mutated
Object.freeze(CONFIG);
Object.freeze(CONFIG.SCORING);
Object.freeze(CONFIG.MIN_DURATION);
