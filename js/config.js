// ============================================================
// GTR FEST 17 CONFIG
// Fill in your credentials before deploying
// ============================================================

const CONFIG = {

  // --- Supabase ---
  SUPABASE_URL: 'https://cusjylwdeutawnbhhcpv.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_QCHhsyVbnij44Da6x8Nl9w_ZBVRDQwW',

  // --- Challenge Period ---
  CHALLENGE_START: '2026-07-01',
  CHALLENGE_END:   '2026-08-14',
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
    DURATION_BASE:        45,
    DURATION_STEP:        30,
    DURATION_BONUS:        5,
    SPORT_BONUS:          15,
    MIN_CAL_PER_MIN:       3,
    DAILY_TOP_CALORIES:    5,
    STREAK_MILESTONES:  [10, 20, 30, 40],
    // Distance bonus per sport: { per: km, bonus: points per step }
    DISTANCE: {
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
      'Hiking':   { per: 3, bonus: 5 },
      'Walking':  { per: 3, bonus: 5 },
      'Climbing': { per: 0, bonus: 0 },
      // Gym & Fitness
      'Strength Training': { per: 0, bonus: 0 },
      'HIIT':              { per: 0, bonus: 0 },
      'Cardio':            { per: 0, bonus: 0 },
      'Yoga':              { per: 0, bonus: 0 },
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
    },
    // Distance ranking categories
    DISTANCE_CATEGORIES: [
      { key: 'all',   label: '🏃 Semua' },
      { key: 'foot',  label: '🏃 Lari & Jalan', sports: ['Road Running','Trail Running','Track Running','Treadmill Running','Virtual Running','Hiking','Walking'] },
      { key: 'cycle', label: '🚴 Sepeda', sports: ['Road Cycling','Mountain Biking (MTB)','Gravel Cycling','Indoor Cycling','eBike'] },
      { key: 'water', label: '🌊 Air', sports: ['Pool Swimming','Open Water Swimming','Rowing','Kayaking','Stand-Up Paddleboarding (SUP)','Indoor Rowing'] },
      { key: 'other', label: '🎯 Lainnya', sports: ['Triathlon','Elliptical','Golf'] },
    ],
    // Elevation bonus per sport: { per: meters, bonus: points per step }
    ELEVATION: {
      'Trail Running':  { per: 100, bonus: 5 },
      'Hiking':         { per: 100, bonus: 5 },
      'Walking':        { per: 100, bonus: 5 },
      'Climbing':       { per: 100, bonus: 5 },
      'Road Cycling':              { per: 200, bonus: 5 },
      'Mountain Biking (MTB)':     { per: 200, bonus: 5 },
      'Gravel Cycling':            { per: 200, bonus: 5 },
      'eBike':                     { per: 300, bonus: 3 },
      'DEFAULT': { per: 0, bonus: 0 },
    },
  },
};

Object.freeze(CONFIG);
Object.freeze(CONFIG.SCORING);
Object.freeze(CONFIG.SCORING.DISTANCE);
Object.freeze(CONFIG.SCORING.ELEVATION);
Object.freeze(CONFIG.MIN_DURATION);
