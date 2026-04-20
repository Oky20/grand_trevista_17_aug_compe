// ============================================================
// API HELPERS - Supabase REST API (no JS client needed)
// Compatible with new sb_publishable_ key format
// ============================================================

function sbFetch(path, options = {}) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey':        CONFIG.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    'Content-Type':  'application/json',
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}

// -- STRAVA --------------------------------------------------

const Strava = {
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id:       CONFIG.STRAVA_CLIENT_ID,
      redirect_uri:    CONFIG.STRAVA_REDIRECT_URI,
      response_type:   'code',
      scope:           'read,activity:read_all',
      approval_prompt: 'auto',
    });
    return `https://www.strava.com/oauth/authorize?${params}`;
  },

  async exchangeCode(code) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/strava-auth`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async fetchActivities(athleteId, startDate) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/strava-sync`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ athlete_id: athleteId, start_date: startDate || CONFIG.CHALLENGE_START }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

// -- SUPABASE DB ----------------------------------------------

const DB = {
  async getMembers() {
    const res = await sbFetch('members?order=name');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getMember(athleteId) {
    const res = await sbFetch(`members?strava_athlete_id=eq.${athleteId}&limit=1`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data[0] || null;
  },

  async getActivities(startDate, endDate) {
    const start = startDate || CONFIG.CHALLENGE_START;
    const end   = endDate   || CONFIG.CHALLENGE_END;
    // Subtract 1 day from start to account for UTC offset (WIB = UTC+7)
    const startDt = new Date(start);
    startDt.setDate(startDt.getDate() - 1);
    const startAdj = startDt.toISOString().slice(0, 10);
    const res = await sbFetch(
      `activities?start_date=gte.${startAdj}&start_date=lte.${end}T23:59:59&order=start_date.asc`
    );
    if (!res.ok) throw new Error(await res.text());
    // Filter client-side to correct date range (local date)
    const data = await res.json();
    return data.filter(a => {
      const localDate = new Date(a.start_date).toLocaleDateString('en-CA'); // YYYY-MM-DD
      return localDate >= start && localDate <= end;
    });
  },

  async getLeaderboard(startDate, endDate) {
    const start = startDate || CONFIG.CHALLENGE_START;
    const end   = endDate   || CONFIG.CHALLENGE_END;
    const [members, activities] = await Promise.all([
      DB.getMembers(),
      DB.getActivities(start, end),
    ]);
    const leaderboard = Scoring.calcLeaderboard(members, activities);
    const teams       = Scoring.calcTeamStats(leaderboard);
    return { leaderboard, teams };
  },
};

// -- SESSION --------------------------------------------------

const Session = {
  get() {
    try { return JSON.parse(localStorage.getItem('athlete') || 'null'); } catch { return null; }
  },
  set(athlete) {
    localStorage.setItem('athlete', JSON.stringify(athlete));
  },
  clear() {
    localStorage.removeItem('athlete');
  },
};
