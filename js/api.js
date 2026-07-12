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

  async getAllActivities() {
    // Supabase caps rows per request at the project's db-max-rows setting
    // (default 1000) regardless of any ?limit= we pass, so page through
    // with offset. Fetch page 1 with an exact count, then fire the rest
    // of the pages in parallel instead of one round-trip at a time —
    // matters once submissions run into the thousands.
    const pageSize = 1000;
    const first = await sbFetch(`activities?order=start_date.asc&offset=0&limit=${pageSize}`, {
      headers: { 'Prefer': 'count=exact' },
    });
    if (!first.ok) throw new Error(await first.text());
    const firstPage = await first.json();
    const range = first.headers.get('content-range'); // "0-999/12345"
    const total = range ? parseInt(range.split('/')[1], 10) : firstPage.length;

    const offsets = [];
    for (let offset = pageSize; offset < total; offset += pageSize) offsets.push(offset);

    const restPages = await Promise.all(offsets.map(async offset => {
      const res = await sbFetch(`activities?order=start_date.asc&offset=${offset}&limit=${pageSize}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }));

    const all = [firstPage, ...restPages].flat();
    console.log('getAllActivities: fetched', all.length, 'of', total, 'total activities from DB');
    return all;
  },

  async getActivities(startDate, endDate) {
    const start = startDate || CONFIG.CHALLENGE_START;
    const end   = endDate   || CONFIG.CHALLENGE_END;
    const data = await DB.getAllActivities();
    const filtered = data.filter(a => {
      if (!a.start_date) return false;
      const localDate = jakartaDateKey(a.start_date);
      return localDate >= start && localDate <= end;
    });
    console.log('getActivities: after date filter (' + start + ' to ' + end + '):', filtered.length);
    if (filtered.length > 0) console.log('getActivities: first filtered activity=', JSON.stringify(filtered[0]));
    if (data.length !== filtered.length) console.log('getActivities: filtered out ' + (data.length - filtered.length) + ' activities outside date range');
    return filtered;
  },

  async getLeaderboard(startDate, endDate) {
    const start = startDate || CONFIG.CHALLENGE_START;
    const end   = endDate   || CONFIG.CHALLENGE_END;
    const [users, allActivities] = await Promise.all([
      DB.getUsers(),
      DB.getAllActivities(),
    ]);
    console.log('getLeaderboard: users count=', users.length, 'total activities count=', allActivities.length);
    if (users.length > 0) console.log('getLeaderboard: first user=', JSON.stringify({id:users[0].id, name:users[0].name, team_id:users[0].team_id}));
    const leaderboard = Scoring.calcLeaderboard(users, allActivities, start, end);
    const teams       = Scoring.calcTeamStats(leaderboard);
    return { leaderboard, teams };
  },
};

// -- ACTIVITY (Self-service delete) ----------------------------

const Activity = {
  async delete(activityId) {
    const u = Session.get();
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/activity-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ activity_id: activityId, user_id: u ? u.id : null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete activity.');
    }
    return res.json();
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
