// ============================================================
// SCORING ENGINE
// Pure functions — no DOM, no Supabase deps
// ============================================================

const Scoring = (() => {

  // Activities dated before CONFIG.RULE_CUTOVER_DATE (Jakarta) score under the
  // legacy formulas untouched; everything from that date forward uses the
  // current anti-abuse rules. Keeps history from silently getting rescored.
  function isLegacyActivity(activity) {
    return jakartaDateKey(activity.start_date) < CONFIG.RULE_CUTOVER_DATE;
  }

  function getMinDuration(sportType) {
    return CONFIG.MIN_DURATION[sportType] ?? CONFIG.MIN_DURATION['DEFAULT'];
  }

  // Generic tiered-bonus accumulator shared by duration/calorie/distance bonuses.
  // tiers: [{ upTo, step, bonus }] — cumulative upper bounds, each tier's own
  // step/bonus rate applies only within that tier's span (no carryover of steps
  // between tiers). Values beyond the last tier's upTo earn nothing more (flat).
  function tieredBonus(value, tiers) {
    let total = 0;
    let prevUpTo = 0;
    for (const { upTo, step, bonus } of tiers) {
      if (value <= prevUpTo) break;
      const span = Math.min(value, upTo) - prevUpTo;
      total += Math.floor(span / step) * bonus;
      prevUpTo = upTo;
    }
    return total;
  }

  // 1st non-distance-bonus-eligible activity of the day earns full SPORT_BONUS,
  // then it halves (rounded) per subsequent occurrence, dropping to 0 after the
  // configured occurrence cap.
  function nonDistanceSportBonus(n) {
    const S = CONFIG.SCORING;
    if (n > S.SPORT_BONUS_OCCURRENCE_CAP) return 0;
    return Math.round(S.SPORT_BONUS / (2 ** (n - 1)));
  }

  // Clamps calories to what's plausible for the sport given its duration, using
  // the MET-derived cal/min ceiling (CONFIG.SCORING.CAL_PER_MIN). Never rejects —
  // an implausibly high number just means the reported calories aren't trusted,
  // not that the session didn't happen. Raw calories are untouched elsewhere.
  function getEffectiveCalories(activity) {
    const calories = activity.calories || 0;
    if (calories <= 0) return 0;
    const actualMinutes = (activity.moving_time || 0) / 60;
    if (actualMinutes <= 0) return 0;
    const sportType = (activity.sport_type || '').trim();
    const range = CONFIG.SCORING.CAL_PER_MIN[sportType] || CONFIG.SCORING.CAL_PER_MIN['DEFAULT'];
    return Math.min(calories, range.max * actualMinutes);
  }

  // ── LEGACY VALIDATION / SCORING (activities before RULE_CUTOVER_DATE) ──────
  // Kept byte-for-byte equivalent to the pre-anti-abuse-rewrite implementation.

  function isValidActivityLegacy(activity) {
    const reasons = [];
    const minMinutes = getMinDuration(activity.sport_type);
    const actualMinutes = (activity.moving_time || 0) / 60;
    if (actualMinutes < minMinutes) {
      reasons.push('Duration: need ' + minMinutes + 'm, got ' + Math.round(actualMinutes) + 'm');
    }
    const calories = activity.calories || 0;
    if (calories > 0) {
      const sportType = (activity.sport_type || '').trim();
      const S = CONFIG.SCORING_LEGACY;
      const distCfg = (S.DISTANCE && S.DISTANCE[sportType]) || S.DISTANCE['DEFAULT'] || { per: 5, bonus: 5 };
      if (distCfg.per > 0) {
        const calPerMin = calories / actualMinutes;
        const minCalPerMin = S.MIN_CAL_PER_MIN ?? 4;
        if (calPerMin < minCalPerMin) {
          reasons.push('Cal/min: need ≥' + minCalPerMin + ', got ' + calPerMin.toFixed(1));
        }
      }
    }
    return { valid: reasons.length === 0, reasons: reasons };
  }

  function calcActivityPointsLegacy(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus) {
    const validity = isValidActivityLegacy(activity);
    if (!validity.valid) {
      return { total: 0, breakdown: { valid: false, reasons: validity.reasons } };
    }

    const S = CONFIG.SCORING_LEGACY;
    const breakdown = { valid: true };
    let total = 0;

    breakdown.base = S.BASE_ACTIVITY;
    total += S.BASE_ACTIVITY;

    const rawCalories = activity.calories || 0;
    breakdown.caloriesRaw = rawCalories;
    breakdown.caloriesEffective = rawCalories;
    const calMult = Math.floor(rawCalories / S.CALORIES_PER);
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
      breakdown.sportBonus = S.SPORT_BONUS || 15;
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
    breakdown.streak30 = 0;
    if (streakContext) {
      const { currentStreak, claimedMilestones, claimedStreak30 } = streakContext;
      const milestones = S.STREAK_MILESTONES;
      const milestonesCap = milestones.length;
      const earnedCount = Math.floor(currentStreak / 3);

      for (let i = 0; i < earnedCount; i++) {
        if (!claimedMilestones.has(i)) {
          const idx = Math.min(i, milestonesCap - 1);
          breakdown.streak += milestones[idx];
        }
      }
      total += breakdown.streak;

      if (currentStreak >= S.STREAK_BONUS_30_DAYS && !claimedStreak30) {
        breakdown.streak30 = S.STREAK_BONUS_30_POINTS;
        total += breakdown.streak30;
      }
    }

    breakdown.reactivation = isReactivation ? S.REACTIVATION_BONUS : 0;
    total += breakdown.reactivation;

    breakdown.groupBonus = groupBonus || 0;
    total += breakdown.groupBonus;

    return { total, breakdown };
  }

  // ── CURRENT VALIDATION / SCORING (RULE_CUTOVER_DATE onward) ────────────────

  function isValidActivityNew(activity) {
    const reasons = [];
    const S = CONFIG.SCORING;
    const actualMinutes = (activity.moving_time || 0) / 60;
    if (actualMinutes < S.MIN_DURATION) {
      reasons.push('Duration: need ' + S.MIN_DURATION + 'm, got ' + Math.round(actualMinutes) + 'm');
    }

    const sportType = (activity.sport_type || '').trim();
    const calories = activity.calories || 0;
    if (calories > 0 && actualMinutes > 0) {
      const range = S.CAL_PER_MIN[sportType] || S.CAL_PER_MIN['DEFAULT'];
      const calPerMin = calories / actualMinutes;
      if (calPerMin < range.min) {
        reasons.push('Cal/min: need ≥' + range.min + ', got ' + calPerMin.toFixed(1));
      }
    }

    const paceCfg = S.PACE[sportType];
    if (paceCfg) {
      const distKm = (activity.distance || 0) / 1000;
      if (distKm < paceCfg.minDistanceKm) {
        reasons.push('Distance: need ≥' + paceCfg.minDistanceKm + 'km, got ' + distKm.toFixed(2) + 'km');
      } else {
        const pace = actualMinutes / distKm;
        if (pace > paceCfg.maxPaceMinPerKm) {
          reasons.push('Pace: need ≤' + paceCfg.maxPaceMinPerKm + 'min/km, got ' + pace.toFixed(1) + 'min/km');
        }
      }
    }

    return { valid: reasons.length === 0, reasons: reasons };
  }

  // poolContext (only present for valid, current-rules activities) carries the
  // user's running totals for that Jakarta day BEFORE this activity, so each
  // bonus below is the marginal gain from pushing the pool further — not the
  // activity's own value scored in isolation.
  function calcActivityPointsNew(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus, poolContext, teamActivationBonus) {
    const validity = isValidActivityNew(activity);
    if (!validity.valid) {
      return { total: 0, breakdown: { valid: false, reasons: validity.reasons } };
    }

    const S = CONFIG.SCORING;
    const breakdown = { valid: true };
    let total = 0;

    breakdown.base = S.BASE_ACTIVITY;
    total += S.BASE_ACTIVITY;

    const rawCalories = activity.calories || 0;
    const effCalories = getEffectiveCalories(activity);
    breakdown.caloriesRaw = rawCalories;
    breakdown.caloriesEffective = effCalories;
    const calPoolBefore = poolContext.caloriePoolBefore;
    const calPoolAfter = calPoolBefore + effCalories;
    breakdown.calories = tieredBonus(calPoolAfter, S.CALORIE_TIERS) - tieredBonus(calPoolBefore, S.CALORIE_TIERS);
    total += breakdown.calories;

    const sportType = (activity.sport_type || '').trim();
    const distCfg = (S.DISTANCE && S.DISTANCE[sportType]) || S.DISTANCE['DEFAULT'] || { per: 5, bonus: 5 };
    const distKm = (activity.distance || 0) / 1000;

    if (distCfg.per > 0 && distKm > 0) {
      const distTiers = [
        { upTo: 4 * distCfg.per, step: distCfg.per, bonus: distCfg.bonus },
        { upTo: 8 * distCfg.per, step: 2 * distCfg.per, bonus: distCfg.bonus },
      ];
      const distPoolBefore = poolContext.distancePoolBefore;
      const distPoolAfter = distPoolBefore + distKm;
      breakdown.distance = tieredBonus(distPoolAfter, distTiers) - tieredBonus(distPoolBefore, distTiers);
      breakdown.sportBonus = 0;
    } else {
      breakdown.distance = 0;
      breakdown.sportBonus = nonDistanceSportBonus(poolContext.nonDistanceCountBefore + 1);
    }
    total += breakdown.distance;
    total += breakdown.sportBonus;

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
    const durPoolBefore = poolContext.durationPoolBefore;
    const durPoolAfter = durPoolBefore + durMin;
    const durEffBefore = Math.max(0, durPoolBefore - S.DURATION_BASE);
    const durEffAfter = Math.max(0, durPoolAfter - S.DURATION_BASE);
    breakdown.duration = tieredBonus(durEffAfter, S.DURATION_TIERS) - tieredBonus(durEffBefore, S.DURATION_TIERS);
    total += breakdown.duration;

    if (isDailyTopCalories) {
      breakdown.dailyTop = S.DAILY_TOP_CALORIES;
      total += S.DAILY_TOP_CALORIES;
    } else {
      breakdown.dailyTop = 0;
    }

    breakdown.streak = 0;
    breakdown.streak30 = 0;
    if (streakContext) {
      const { currentStreak, claimedMilestones, claimedStreak30 } = streakContext;
      const milestones = S.STREAK_MILESTONES;
      const milestonesCap = milestones.length;
      const earnedCount = Math.floor(currentStreak / 3);

      for (let i = 0; i < earnedCount; i++) {
        if (!claimedMilestones.has(i)) {
          const idx = Math.min(i, milestonesCap - 1);
          breakdown.streak += milestones[idx];
        }
      }
      total += breakdown.streak;

      if (currentStreak >= S.STREAK_BONUS_30_DAYS && !claimedStreak30) {
        breakdown.streak30 = S.STREAK_BONUS_30_POINTS;
        total += breakdown.streak30;
      }
    }

    breakdown.reactivation = isReactivation ? S.REACTIVATION_BONUS : 0;
    total += breakdown.reactivation;

    breakdown.groupBonus = groupBonus || 0;
    total += breakdown.groupBonus;

    breakdown.teamActivation = teamActivationBonus || 0;
    total += breakdown.teamActivation;

    return { total, breakdown };
  }

  // ── PUBLIC DISPATCHERS ──────────────────────────────────────────────────
  // Route to the legacy or current implementation based on the activity's own
  // date, so callers never need to know which rule set applies.

  function isValidActivity(activity) {
    return isLegacyActivity(activity) ? isValidActivityLegacy(activity) : isValidActivityNew(activity);
  }

  function calcActivityPoints(activity, streakContext = null, isDailyTopCalories = false, isReactivation = false, groupBonus = 0, poolContext = null, teamActivationBonus = 0) {
    return isLegacyActivity(activity)
      ? calcActivityPointsLegacy(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus)
      : calcActivityPointsNew(activity, streakContext, isDailyTopCalories, isReactivation, groupBonus, poolContext, teamActivationBonus);
  }

  // Resolves mutually-tagged group workouts: a group of >= GROUP_MIN_SIZE people
  // each qualifies only once every member has their own matching activity
  // (same sport, close start time, identical companion tag set on all sides).
  function calcGroupMatches(activities) {
    const S = CONFIG.SCORING; // GROUP_* values are identical between legacy/current
    const bonusByActId = new Map();

    const candidates = activities.filter(act =>
      Array.isArray(act.companions) &&
      act.companions.length >= S.GROUP_MIN_SIZE - 1 &&
      isValidActivity(act).valid
    );

    const setEquals = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

    candidates.forEach(a => {
      const group = new Set([a.user_id, ...a.companions]);
      if (group.size < S.GROUP_MIN_SIZE) return;
      const aTime = new Date(a.start_date).getTime();

      const allMatch = [...group].every(memberId => candidates.some(b => {
        if (b.user_id !== memberId || b.sport_type !== a.sport_type) return false;
        const bTime = new Date(b.start_date).getTime();
        if (Math.abs(bTime - aTime) > S.GROUP_TIME_WINDOW_MIN * 60000) return false;
        return setEquals(new Set([b.user_id, ...b.companions]), group);
      }));

      if (allMatch) bonusByActId.set(a.id, S.GROUP_BONUS_PER_PERSON);
    });

    return bonusByActId;
  }

  // Once a team has >= TEAM_ACTIVATION_MIN_USERS distinct members with a valid
  // activity on the same Mon-Thu day (Jakarta, from TEAM_ACTIVATION_START_DATE
  // onward), every one of those members earns the bonus on their own earliest
  // valid activity that day.
  function calcTeamActivationBonus(activities, users) {
    const S = CONFIG.SCORING;
    const userTeam = {};
    users.forEach(u => { userTeam[u.id] = u.team_id; });

    const candidates = activities.filter(act =>
      jakartaDateKey(act.start_date) >= S.TEAM_ACTIVATION_START_DATE &&
      S.TEAM_ACTIVATION_WEEKDAYS.includes(jakartaWeekday(act.start_date)) &&
      isValidActivity(act).valid
    );

    // `${team_id}|${day}` -> Map<user_id, earliest candidate activity that day>
    const groups = new Map();
    candidates.forEach(act => {
      const team = userTeam[act.user_id];
      if (team == null) return;
      const key = team + '|' + jakartaDateKey(act.start_date);
      if (!groups.has(key)) groups.set(key, new Map());
      const byUser = groups.get(key);
      const existing = byUser.get(act.user_id);
      if (!existing || new Date(act.start_date) < new Date(existing.start_date)) {
        byUser.set(act.user_id, act);
      }
    });

    const bonusByActId = new Map();
    groups.forEach(byUser => {
      if (byUser.size < S.TEAM_ACTIVATION_MIN_USERS) return;
      byUser.forEach(act => bonusByActId.set(act.id, S.TEAM_ACTIVATION_BONUS));
    });

    return bonusByActId;
  }

  function calcLeaderboard(users, activities, windowStart, windowEnd) {
    const S = CONFIG.SCORING; // GROUP_*/STREAK_*/REACTIVATION_* identical between legacy/current
    const inWindow = day => (!windowStart || day >= windowStart) && (!windowEnd || day <= windowEnd);
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
        claimedStreak30: false,
        activities: [],
      };
    });

    const sorted = [...activities].sort((a, b) =>
      new Date(a.start_date) - new Date(b.start_date)
    );

    // Comparison calories for "daily top" / totals: effective (clamped) for
    // current-rules activities, raw for legacy — each era judged by its own rules.
    const comparisonCalories = act => isLegacyActivity(act) ? (act.calories || 0) : getEffectiveCalories(act);

    const dailyMaxCalMap = {};
    sorted.forEach(act => {
      if (!isValidActivity(act).valid) return;
      const day = jakartaDateKey(act.start_date);
      const cal = comparisonCalories(act);
      if (!dailyMaxCalMap[day] || cal > dailyMaxCalMap[day]) dailyMaxCalMap[day] = cal;
    });

    const groupBonusByActId = calcGroupMatches(activities);
    const teamActivationByActId = calcTeamActivationBonus(activities, users);
    const lastActiveDateMap = {};
    const streakMap = {};

    // Daily pools for current-rules activities only — legacy activities are
    // scored independently as always and never touch these.
    const durationPool = {};   // `${userId}|${day}` -> raw minutes so far
    const caloriePool = {};    // `${userId}|${day}` -> effective calories so far
    const distancePool = {};   // `${userId}|${day}|${sport}` -> km so far
    const nonDistanceCount = {}; // `${userId}|${day}` -> count so far

    sorted.forEach(act => {
      const m = userMap[act.user_id];
      if (!m) {
        console.warn('calcLeaderboard: activity user not found in users list, user_id=' + act.user_id + ' activity_id=' + (act.id || '?'));
        return;
      }

      const day = jakartaDateKey(act.start_date);
      // Streak/bonus/reactivation all follow the report-range window: an
      // activity outside [windowStart, windowEnd] doesn't count toward the
      // streak, doesn't break it, and can't earn points.
      if (!inWindow(day)) return;

      const activityValid = isValidActivity(act).valid;

      // Invalid activities (too short, etc.) don't count as an "active day" —
      // otherwise they'd still inflate the streak and unlock milestone bonuses
      // on a later, actually-valid activity.
      let lastDay = null;
      let gapDays = null;
      let isReactivation = false;

      if (activityValid) {
        lastDay = lastActiveDateMap[act.user_id];
        if (lastDay) {
          gapDays = (new Date(day + 'T00:00:00Z') - new Date(lastDay + 'T00:00:00Z')) / 86400000;
          if (gapDays === 1) {
            streakMap[act.user_id] += 1;
          } else if (gapDays > 1) {
            streakMap[act.user_id] = 1;
          }
        } else {
          streakMap[act.user_id] = 1;
        }
        isReactivation = lastDay != null && gapDays != null && gapDays >= S.REACTIVATION_GAP_DAYS;
        if (day !== lastDay) lastActiveDateMap[act.user_id] = day;
        m.currentStreak = streakMap[act.user_id];
      }

      const maxOverallCal = dailyMaxCalMap[day] || 0;
      const isDailyTop = maxOverallCal > 0 && comparisonCalories(act) === maxOverallCal;

      const legacy = isLegacyActivity(act);
      let poolContext = null;
      const poolKey = act.user_id + '|' + day;
      const sportType = (act.sport_type || '').trim();
      const distCfg = (S.DISTANCE && S.DISTANCE[sportType]) || S.DISTANCE['DEFAULT'] || { per: 5, bonus: 5 };
      const distEligible = distCfg.per > 0 && (act.distance || 0) > 0;
      const distKey = poolKey + '|' + sportType;

      if (!legacy && activityValid) {
        poolContext = {
          durationPoolBefore: durationPool[poolKey] || 0,
          caloriePoolBefore: caloriePool[poolKey] || 0,
          distancePoolBefore: distEligible ? (distancePool[distKey] || 0) : 0,
          nonDistanceCountBefore: nonDistanceCount[poolKey] || 0,
        };
      }

      const result = calcActivityPoints(act, {
        currentStreak: streakMap[act.user_id] || 0,
        claimedMilestones: m.claimedMilestones,
        claimedStreak30: m.claimedStreak30,
      }, isDailyTop, isReactivation, groupBonusByActId.get(act.id) || 0, poolContext, teamActivationByActId.get(act.id) || 0);

      if (!result.breakdown.valid) {
        console.log('calcLeaderboard: INVALID activity user=' + (m.name || m.id) + ' sport=' + act.sport_type + ' date=' + act.start_date + ' reasons=' + JSON.stringify(result.breakdown.reasons));
      }

      if (result.breakdown.valid) {
        const earned = Math.floor((streakMap[act.user_id] || 0) / 3);
        for (let i = 0; i < earned; i++) {
          m.claimedMilestones.add(i);
        }
        if (result.breakdown.streak30 > 0) m.claimedStreak30 = true;

        if (!legacy) {
          durationPool[poolKey] = (durationPool[poolKey] || 0) + (act.moving_time || 0) / 60;
          caloriePool[poolKey] = (caloriePool[poolKey] || 0) + getEffectiveCalories(act);
          if (distEligible) {
            distancePool[distKey] = (distancePool[distKey] || 0) + (act.distance || 0) / 1000;
          } else {
            nonDistanceCount[poolKey] = (nonDistanceCount[poolKey] || 0) + 1;
          }
        }

        m.totalPoints     += result.total;
        m.totalCalories   += comparisonCalories(act);
        m.totalDistanceKm += (act.distance || 0) / 1000;
        m.totalDurationMin += (act.moving_time || 0) / 60;
        m.activityCount   += 1;
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

  return { calcLeaderboard, calcTeamStats, calcActivityPoints, isValidActivity, getMinDuration, isLegacyActivity, getEffectiveCalories, tieredBonus, nonDistanceSportBonus, calcTeamActivationBonus };
})();
