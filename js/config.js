// ============================================================
// GTR FEST 17 CONFIG
// Fill in your credentials before deploying
// ============================================================

const CONFIG = {

  // --- Supabase ---
  SUPABASE_URL: 'https://cusjylwdeutawnbhhcpv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_QCHhsyVbnij44Da6x8Nl9w_ZBVRDQwW',

  // --- Challenge Period ---
  CHALLENGE_START: '2026-06-01',
  CHALLENGE_END:   '2026-06-30',
  CHALLENGE_NAME:  'GTR 17 Aug Fitness Challenge 2026',

  // --- Teams ---
  TEAMS: [
    { id: 1, name: 'Zona 1',  color: '#FF6B6B', emoji: '🔴' },
    { id: 2, name: 'Zona 2',  color: '#4ECDC4', emoji: '🟢' },
    { id: 3, name: 'Zona 3',  color: '#FFE66D', emoji: '🟡' },
    { id: 4, name: 'Zona 4',  color: '#A78BFA', emoji: '🟣' },
    { id: 5, name: 'Zona 5',  color: '#F97316', emoji: '🟠' },
    { id: 6, name: 'Zona 6',  color: '#60A5FA', emoji: '🔵' },
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
    BASE_ACTIVITY:        10,
    CALORIES_PER:        250,
    CALORIES_BONUS:        5,
    DISTANCE_PER:        2.5,
    DISTANCE_BONUS:        5,
    DURATION_BASE:        45,
    DURATION_STEP:        30,
    DURATION_BONUS:        5,
    MIN_CAL_PER_MIN:       4,
    DAILY_TOP_CALORIES:    5,
    STREAK_MILESTONES:  [10, 20, 30, 40],
  },
};

Object.freeze(CONFIG);
Object.freeze(CONFIG.SCORING);
Object.freeze(CONFIG.MIN_DURATION);
