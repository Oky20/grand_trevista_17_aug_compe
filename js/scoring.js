// ============================================================
// SCORING ENGINE
// Pure functions — no DOM, no Supabase deps
// ============================================================

const Scoring = (() => {

  function getMinDuration(sportType) {
    return CONFIG.MIN_DURATION[sportType] ?? CONFIG.MIN_DURATION['DEFAULT'];
  }

  function isValidActivity(activity) {
    const minMinutes = getMinDuration(activity.sport_type);
    const actualMinutes = (activity.moving_time || 0) / 60;
    if (actualMinutes < minMinutes) return false;
    const calories = activity.calories || 0;
    if (calories > 0) {
      const calPerMin = calories / actualMinutes;
      const minCalPerMin = CONFIG.SCORING.MIN_CAL_PER_MIN ?? 4;
      if (calPerMin < minCalPerMin) return false;
    }
    return true;
  }

  function calcActivityPoints(activity, streakContext = null, isDailyTopCalories = false) {
    if (!isValidActivity(activity)) {
      return { total: 0, breakdown: { valid: false } };
    }

    const S = CONFIG.SCORING;
    const breakdown = { valid: true };
    let total = 0;

    breakdown.base = S.BASE_ACTIVITY;
    total += S.BASE_ACTIVITY;

    const calMult = Math.floor((activity.calories || 0) / S.CALORIES_PER);
    breakdown.calories = calMult * S.CALORIES_BONUS;
    total += breakdown.calories;

    const distKm = (activity.distance || 0) / 1000;
    const distMult = Math.floor(distKm / S.DISTANCE_PER);
    breakdown.distance = distMult * S.DISTANCE_BONUS;
    total += breakdown.distance;

    const durMin = (activity.moving_time || 0) / 60;
    const durSteps = Math.max(0, Math.floor((durMin - S.DURATION_BASE) / S.DURATION_STEP));
    breakdown.duration = durSteps * S.DURATION_BONUS;
    total += breakdown.duration;

    if (isDailyTopCalories) {
      breakdown.dailyTop = S.DAILY_TOP_CALORIES;
      total += S.DAILY_TOP_CALORIES;
    } else {
      breakdown.dailyTop = 0;
    }

    breakdown.streak = 0;
    if (streakContext) {
      const { currentStreak, claimedMilestones } = streakContext;
      const milestones = CONFIG.SCORING.STREAK_MILESTONES;
      const milestonesCap = milestones.length;
      const earnedCount = Math.floor(currentStreak / 3);

      for (let i = 0; i < earnedCount; i++) {
        if (!claimedMilestones.has(i)) {
          const idx = Math.min(i, milestonesCap - 1);
          breakdown.streak += milestones[idx];
        }
      }
      total += breakdown.streak;
    }

    return { total, breakdown };
  }

  function calcLeaderboard(users, activities) {
    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = {
        ...u,
        totalPoints:     0,
        totalCalories:   0,
        totalDistanceKm: 0,
        totalDurationMin: 0,
        activityCount:   0,
        currentStreak:   0,
        claimedMilestones: new Set(),
        activities: [],
      };
    });

    const sorted = [...activities].sort((a, b) =>
      new Date(a.start_date) - new Date(b.start_date)
    );

    const dailyCalMap = {};
    sorted.forEach(act => {
      const day = act.start_date.slice(0, 10);
      if (!dailyCalMap[day]) dailyCalMap[day] = {};
      dailyCalMap[day][act.user_id] = (dailyCalMap[day][act.user_id] || 0) + (act.calories || 0);
    });

    const lastActiveDateMap = {};

    sorted.forEach(act => {
      const m = userMap[act.user_id];
      if (!m) return;

      const day = act.start_date.slice(0, 10);
      const lastDay = lastActiveDateMap[act.user_id];

      if (lastDay) {
        const diff = (new Date(day) - new Date(lastDay)) / 86400000;
        if (diff === 1) {
          m.currentStreak += 1;
        } else if (diff > 1) {
          m.currentStreak = 1;
        }
      } else {
        m.currentStreak = 1;
      }
      if (day !== lastDay) lastActiveDateMap[act.user_id] = day;

      const allDayCals = Object.values(dailyCalMap[day] || {});
      const maxOverallCal = allDayCals.length > 0 ? Math.max(...allDayCals) : 0;
      const isDailyTop = maxOverallCal > 0 && (dailyCalMap[day]?.[act.user_id] || 0) >= maxOverallCal;

      const result = calcActivityPoints(act, {
        currentStreak: m.currentStreak,
        claimedMilestones: m.claimedMilestones,
      }, isDailyTop);

      if (result.breakdown.valid) {
        m.totalPoints     += result.total;
        m.totalCalories   += (act.calories || 0);
        m.totalDistanceKm += (act.distance || 0) / 1000;
        m.totalDurationMin += (act.moving_time || 0) / 60;
        m.activityCount   += 1;

        const earned = Math.floor(m.currentStreak / 3);
        for (let i = 0; i < earned; i++) {
          m.claimedMilestones.add(i);
        }

        m.activities.push({ ...act, points: result.total, breakdown: result.breakdown });
      }
    });

    return Object.values(userMap).sort((a, b) => b.totalPoints - a.totalPoints);
  }

  function calcTeamStats(leaderboard) {
    const teamMap = {};
    CONFIG.TEAMS.forEach(t => {
      teamMap[t.id] = {
        ...t,
        totalPoints:     0,
        totalCalories:   0,
        totalDistanceKm: 0,
        totalDurationMin: 0,
        activityCount:   0,
        memberCount:     0,
      };
    });

    leaderboard.forEach(m => {
      const t = teamMap[m.team_id];
      if (!t) return;
      t.totalPoints      += m.totalPoints;
      t.totalCalories    += m.totalCalories;
      t.totalDistanceKm  += m.totalDistanceKm;
      t.totalDurationMin += m.totalDurationMin;
      t.activityCount    += m.activityCount;
      t.memberCount      += 1;
    });

    return Object.values(teamMap).sort((a, b) => b.totalPoints - a.totalPoints);
  }

  return { calcLeaderboard, calcTeamStats, calcActivityPoints, isValidActivity, getMinDuration };
})();
