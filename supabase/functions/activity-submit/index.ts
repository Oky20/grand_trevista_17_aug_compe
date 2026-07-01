// supabase/functions/activity-submit/index.ts
// Validates and inserts an activity entry

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const VALID_SPORT_TYPES = [
  // Running
  "Road Running", "Trail Running", "Track Running", "Treadmill Running", "Virtual Running",
  // Cycling
  "Road Cycling", "Mountain Biking (MTB)", "Gravel Cycling", "Indoor Cycling", "eBike",
  // Swimming
  "Pool Swimming", "Open Water Swimming",
  // Triathlon & Multisport
  "Triathlon",
  // Hiking & Outdoor
  "Hiking", "Walking", "Climbing",
  // Gym & Fitness
  "Strength Training", "HIIT", "Cardio", "Yoga", "Pilates",
  "Elliptical", "Stair Stepper", "Indoor Rowing",
  // Paddling
  "Rowing", "Kayaking", "Stand-Up Paddleboarding (SUP)",
  // Racket Sports
  "Badminton", "Tennis", "Padel", "Pickleball", "Table Tennis",
  // Team Sports
  "Basketball", "Volleyball", "Soccer/Football", "Futsal",
  // Martial Arts
  "Boxing", "Martial Arts",
  // Golf
  "Golf",
];

function hammingDistance(h1: string, h2: string): number {
  let b1 = BigInt("0x" + h1);
  let b2 = BigInt("0x" + h2);
  let xor = b1 ^ b2;
  let count = 0;
  while (xor > 0n) {
    count++;
    xor &= xor - 1n;
  }
  return count;
}

const DHASH_THRESHOLD = 0;

const TIMEZONE = "Asia/Jakarta";
const SUBMIT_WINDOW_DAYS = 7; // activity dated D can be submitted through D+7 (Jakarta time)

function jakartaDateKey(dateInput: string | number | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(dateInput));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { user_id, name, sport_type, distance, moving_time, calories, start_date, image_path, image_hash, dhash, elevation_gain } = body;

    if (!user_id) return json({ error: "Missing user_id" }, 400);
    if (!start_date) return json({ error: "Missing start_date" }, 400);
    if (!sport_type || !VALID_SPORT_TYPES.includes(sport_type)) {
      return json({ error: `Invalid sport_type. Must be one of: ${VALID_SPORT_TYPES.join(", ")}` }, 400);
    }

    const activityDay = jakartaDateKey(start_date);
    const todayDay = jakartaDateKey(new Date());
    const daysSince = (Date.parse(todayDay) - Date.parse(activityDay)) / 86400000;
    if (daysSince > SUBMIT_WINDOW_DAYS) {
      return json({ error: `Submission window closed — activities must be submitted within ${SUBMIT_WINDOW_DAYS} days (activity date: ${activityDay}).` }, 400);
    }
    if (daysSince < 0) {
      return json({ error: "Activity date cannot be in the future." }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for exact duplicate image (SHA-256) — same user only
    if (image_hash) {
      const { data: existingByHash } = await sb
        .from("activities")
        .select("id")
        .eq("image_hash", image_hash)
        .eq("user_id", user_id)
        .limit(1);
      if (existingByHash && existingByHash.length > 0) {
        return json({ error: "This image has already been submitted (exact match)." }, 409);
      }
    }

    // Check for perceptual duplicate (dHash) — same user only
    if (dhash) {
      const { data: existingDh } = await sb
        .from("activities")
        .select("id, dhash")
        .eq("user_id", user_id)
        .not("dhash", "is", null)
        .limit(5000);
      if (existingDh) {
        for (const act of existingDh) {
          if (act.dhash && hammingDistance(dhash, act.dhash) <= DHASH_THRESHOLD) {
            return json({
              error: "This image appears visually similar to an existing submission. If this is a different activity, please contact admin.",
            }, 409);
          }
        }
      }
    }

    // Similarity helper: % difference relative to larger value; both-zero = match
    const withinTol = (a: number, b: number, tol: number): boolean => {
      const maxVal = Math.max(Math.abs(a), Math.abs(b));
      if (maxVal === 0) return true;
      return Math.abs(a - b) / maxVal <= tol;
    };

    const numFields = ["calories", "distance", "moving_time", "elevation_gain"] as const;
    const SIMILARITY_THRESHOLD = 0.80; // 80% = 3.2/4 fields → effectively all must match
    const SAME_USER_TOL = 0.10;        // 10% tolerance for same-user re-submit
    const CROSS_USER_TOL = 0.05;       // 5% tolerance for cross-user fraud (same team only)

    const submitted = {
      calories: (calories || 0) as number,
      distance: (distance || 0) as number,
      moving_time: (moving_time || 0) as number,
      elevation_gain: (elevation_gain || 0) as number,
    };

    const scoreMatch = (act: any, tol: number): number => {
      const matches = numFields.filter(f => withinTol(submitted[f], act[f] || 0, tol)).length;
      return matches / numFields.length;
    };

    // Same-user re-submit check (same date + sport + ≥80% stats match)
    const dateOnly = start_date.substring(0, 10);
    const { data: sameUserActs } = await sb
      .from("activities")
      .select("id, distance, calories, moving_time, elevation_gain")
      .eq("user_id", user_id)
      .eq("sport_type", sport_type)
      .gte("start_date", `${dateOnly}T00:00:00`)
      .lte("start_date", `${dateOnly}T23:59:59`)
      .limit(10);

    if (sameUserActs?.some((a: any) => scoreMatch(a, SAME_USER_TOL) >= SIMILARITY_THRESHOLD)) {
      return json({ error: "Duplicate activity detected — same user, date, sport, and similar stats." }, 409);
    }

    // Cross-user fraud check — only within the same team/zone (cross-zone overlap is fine, fest is casual)
    // Lari bareng safe: calories will differ → only 3/4 match = 75% < 80%
    const { data: submitter } = await sb
      .from("users")
      .select("team_id")
      .eq("id", user_id)
      .single();

    if (submitter?.team_id != null) {
      const { data: crossUserActs } = await sb
        .from("activities")
        .select("id, distance, calories, moving_time, elevation_gain, users!inner(team_id)")
        .neq("user_id", user_id)
        .eq("sport_type", sport_type)
        .eq("users.team_id", submitter.team_id)
        .gte("start_date", `${dateOnly}T00:00:00`)
        .lte("start_date", `${dateOnly}T23:59:59`)
        .limit(1000);

      if (crossUserActs?.some((a: any) => scoreMatch(a, CROSS_USER_TOL) >= SIMILARITY_THRESHOLD)) {
        return json({ error: "Activity data too similar to an existing submission. If this is a legitimate activity, please contact admin." }, 409);
      }
    }

    const submission_method = image_path ? "image_ocr" : "manual";

    const { data, error } = await sb
      .from("activities")
      .insert({
        user_id,
        name: name || sport_type,
        sport_type,
        distance: distance || 0,
        moving_time: moving_time || 0,
        calories: calories || 0,
        start_date,
        image_path: image_path || null,
        image_hash: image_hash || null,
        dhash: dhash || null,
        elevation_gain: elevation_gain || 0,
        submission_method,
        user_corrected: false,
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    return json({ success: true, activity: data });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
