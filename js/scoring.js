// ============================================================
// SCORING ENGINE
// Pure functions — no DOM, no Supabase deps
// ============================================================

const Scoring = (() => {

  function getMinDuration(sportType) {
    return CONFIG.MIN_DURATION[sportType] ?? CONFIG.MIN_DURATION['DEFAULT'];
  }

  function isValidActivity(activity) {
    const reasons = [];
    const minMinutes = getMinDuration(activity.sport_type);
    const actualMinutes = (activity.moving_time || 0) / 60;
    if (actualMinutes < minMinutes) {
      reasons.push('Duration: need ' + minMinutes + 'm, got ' + Math.round(actualMinutes) + 'm');
    }
    const calories = activity.calories || 0;
    if (calories > 0) {
      const sportType = (activity.sport_type || '').trim();
      const distCfg = (CONFIG.SCORING.DISTANCE && CONFIG.SCORING.DISTANCE[sportType]) || CONFIG.SCORING.DISTANCE['DEFAULT'] || { per: 5, bonus: 5 };
      if (distCfg.per > 0) {
        const calPerMin = calories / actualMinutes;
        const minCalPerMin = CONFIG.SCORING.MIN_CAL_PER_MIN ?? 4;
        if (calPerMin < minCalPerMin) {
          reasons.push('Cal/min: need \u2265' + minCalPerMin + ', got ' + calPerMin.toFixed(1));
        }
      }
    }
    return { valid: reasons.length === 0, reasons: reasons };
  }

  function calcActivityPoints(activity, streakContext = null, isDailyTopCalories = false) {
    const validity = isValidActivity(activity);
    if (!validity.valid) {
      return { total: 0, breakdown: { valid: false, reasons: validity.reasons } };
    }

    const S = CONFIG.SCORING;
    const breakdown = { valid: true };
    let total = 0;

    breakdown.base = S.BASE_ACTIVITY;
    total += S.BASE_ACTIVITY;

    const calMult = Math.floor((activity.calories || 0) / S.CALORIES_PER);
    breakdown.calories = calMult * S.CALORIES_BONUS;
    total += breakdown.calories;

    const sportType = (activity.sport_type || '').trim();
    const distCfg = (S.DISTANCE && S.DISTANCE[sportType]) || S.DISTANCE['DEFAULT'] || { per: 5, bonus: 5 };
    if (distCfg.per > 0) {
      const distKm = (activity.distance || 0) / 1000;
      const distMult = Math.floor(distKm / distCfg.per);
      breakdown.distance = distMult * distCfg.bonus;
    } else {
      breakdown.distance = 0;
    }
    total += breakdown.distance;

    if (distCfg.per === 0 || (activity.distance || 0) === 0) {
      breakdown.sportBonus = CONFIG.SCORING.SPORT_BONUS || 15;
      total += breakdown.sportBonus;
    } else {
      breakdown.sportBonus = 0;
    }

    const elevCfg = (S.ELEVATION && S.ELEVATION[sportType]) || S.ELEVATION['DEFAULT'] || { per: 0, bonus: 0 };
    if (elevCfg.per > 0 && (activity.elevation_gain || 0) > 0) {
      const elevM = activity.elevation_gain || 0;
      const elevMult = Math.floor(elevM / elevCfg.per);
      breakdown.elevation = elevMult * elevCfg.bonus;
    } else {
      breakdown.elevation = 0;
    }
    total += breakdown.elevation;

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

    const dailyMaxCalMap = {};
    sorted.forEach(act => {
      const day = jakartaDateKey(act.start_date);
      const cal = act.calories || 0;
      if (!dailyMaxCalMap[day] || cal > dailyMaxCalMap[day]) dailyMaxCalMap[day] = cal;
    });

    const lastActiveDateMap = {};

    sorted.forEach(act => {
      const m = userMap[act.user_id];
      if (!m) {
        console.warn('calcLeaderboard: activity user not found in users list, user_id=' + act.user_id + ' activity_id=' + (act.id || '?'));
        return;
      }

      const day = jakartaDateKey(act.start_date);
      const lastDay = lastActiveDateMap[act.user_id];

      if (lastDay) {
        const diff = (new Date(day + 'T00:00:00Z') - new Date(lastDay + 'T00:00:00Z')) / 86400000;
        if (diff === 1) {
          m.currentStreak += 1;
        } else if (diff > 1) {
          m.currentStreak = 1;
        }
      } else {
        m.currentStreak = 1;
      }
      if (day !== lastDay) lastActiveDateMap[act.user_id] = day;

      const maxOverallCal = dailyMaxCalMap[day] || 0;
      const isDailyTop = maxOverallCal > 0 && (act.calories || 0) === maxOverallCal;

      const result = calcActivityPoints(act, {
        currentStreak: m.currentStreak,
        claimedMilestones: m.claimedMilestones,
      }, isDailyTop);

      if (!result.breakdown.valid) {
        console.log('calcLeaderboard: INVALID activity user=' + (m.name || m.id) + ' sport=' + act.sport_type + ' date=' + act.start_date + ' reasons=' + JSON.stringify(result.breakdown.reasons));
      }

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
      }
      m.activities.push({ ...act, points: result.total, breakdown: result.breakdown });
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
