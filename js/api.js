// ============================================================
// API HELPERS — Supabase REST + OCR + Auth
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

// -- OCR (Gemini via Edge Function) ---------------------------

const OCR = {
  async analyzeImage(base64) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/gemini-ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ image_base64: base64 }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async submitActivity(data) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/activity-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

// -- AUTH (Invite Code) ---------------------------------------

const Auth = {
  async register(code, name) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/invite-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ code, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    Session.set(data.user);
    return data.user;
  },

  async login(name, teamId) {
    const users = await DB.getUsers();
    const user = users.find(u =>
      u.name.toLowerCase() === name.toLowerCase().trim() &&
      u.team_id === teamId
    );
    if (!user) throw new Error('No user found with that name in this team. Try registering first.');
    Session.set(user);
    return user;
  },
};

// -- SUPABASE DB ----------------------------------------------

const DB = {
  async getUsers() {
    const res = await sbFetch('users?order=name');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getUser(userId) {
    const res = await sbFetch(`users?id=eq.${userId}&limit=1`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data[0] || null;
  },

  async getActivities(startDate, endDate) {
    const start = startDate || CONFIG.CHALLENGE_START;
    const end   = endDate   || CONFIG.CHALLENGE_END;
    const startDt = new Date(start);
    startDt.setDate(startDt.getDate() - 1);
    const startAdj = startDt.toISOString().slice(0, 10);
    const endNext = new Date(end);
    endNext.setDate(endNext.getDate() + 1);
    const endAdj = endNext.toISOString().slice(0, 10);
    const res = await sbFetch(
      `activities?start_date=gte.${startAdj}&start_date=lt.${endAdj}&order=start_date.asc`
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.filter(a => {
      const d = new Date(a.start_date);
      const localDate = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      return localDate >= start && localDate <= end;
    });
  },

  async getLeaderboard(startDate, endDate) {
    const start = startDate || CONFIG.CHALLENGE_START;
    const end   = endDate   || CONFIG.CHALLENGE_END;
    const [users, activities] = await Promise.all([
      DB.getUsers(),
      DB.getActivities(start, end),
    ]);
    console.log('getLeaderboard: users count=', users.length, 'activities count=', activities.length);
    if (users.length > 0) console.log('getLeaderboard: first user=', JSON.stringify({id:users[0].id, name:users[0].name, team_id:users[0].team_id}));
    if (activities.length > 0) console.log('getLeaderboard: first activity=', JSON.stringify({user_id:activities[0].user_id, sport_type:activities[0].sport_type, start_date:activities[0].start_date, calories:activities[0].calories}));
    const leaderboard = Scoring.calcLeaderboard(users, activities);
    const teams       = Scoring.calcTeamStats(leaderboard);
    return { leaderboard, teams };
  },
};

// -- SESSION --------------------------------------------------

const Session = {
  get() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  },
  set(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('user');
  },
};
