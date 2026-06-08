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
    'Climbing':               30,
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
    'Tennis':                 45,
    'Padel':                  45,
    'Table Tennis':           30,
    // Team Sports
    'Basketball':             30,
    'Volleyball':             30,
    'Soccer/Football':        45,
    'Futsal':                 45,
    // Martial Arts
    'Boxing':                 30,
    'Martial Arts':           30,
    // Golf
    'Golf':                   60,
    'DEFAULT':                30,
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
