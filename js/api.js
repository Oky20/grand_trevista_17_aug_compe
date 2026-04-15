// ============================================================
// API HELPERS — Supabase + Strava
// ============================================================

// Lazy-init Supabase client
let _sb = null;
function sb() {
  if (!_sb) _sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return _sb;
}

// ── STRAVA ──────────────────────────────────────────────────

const Strava = {
  // Build OAuth URL
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id:     CONFIG.STRAVA_CLIENT_ID,
      redirect_uri:  CONFIG.STRAVA_REDIRECT_URI,
      response_type: 'code',
      scope:         'read,activity:read_all',
      approval_prompt: 'auto',
    });
    return `https://www.strava.com/oauth/authorize?${params}`;
  },

  // Exchange code for tokens (calls Supabase Edge Function to keep secret safe)
  async exchangeCode(code) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/strava-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Fetch activities for a member (calls Edge Function)
  async fetchActivities(athleteId) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/strava-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ athlete_id: athleteId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

// ── SUPABASE DB ──────────────────────────────────────────────

const DB = {
  // Members
  async getMembers() {
    const { data, error } = await sb().from('members').select('*').order('name');
    if (error) throw error;
    return data;
  },

  async getMember(athleteId) {
    const { data, error } = await sb().from('members').select('*').eq('strava_athlete_id', athleteId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async upsertMember(member) {
    const { data, error } = await sb().from('members').upsert(member, { onConflict: 'strava_athlete_id' }).select().single();
    if (error) throw error;
    return data;
  },

  async updateMemberTeam(athleteId, teamId) {
    const { error } = await sb().from('members').update({ team_id: teamId }).eq('strava_athlete_id', athleteId);
    if (error) throw error;
  },

  // Activities
  async getActivities(startDate, endDate) {
    const { data, error } = await sb()
      .from('activities')
      .select('*')
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')
      .order('start_date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async upsertActivities(activities) {
    if (!activities.length) return;
    const { error } = await sb().from('activities').upsert(activities, { onConflict: 'strava_activity_id' });
    if (error) throw error;
  },

  // Leaderboard (computed view from DB, refreshed via Edge Function)
  async getLeaderboard() {
    const [members, activities] = await Promise.all([
      DB.getMembers(),
      DB.getActivities(CONFIG.CHALLENGE_START, CONFIG.CHALLENGE_END),
    ]);
    const leaderboard = Scoring.calcLeaderboard(members, activities);
    const teams       = Scoring.calcTeamStats(leaderboard);
    return { leaderboard, teams };
  },
};

// ── SESSION ──────────────────────────────────────────────────

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
