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

const TIMEZONE = "Asia/Jakarta";
const SUBMIT_WINDOW_DAYS = 7; // activity dated D can be submitted through D+7 (Jakarta time)

function jakartaDateKey(dateInput: string | number | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(dateInput));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { user_id, name, sport_type, distance, moving_time, calories, start_date, image_path, image_hash, dhash, elevation_gain, companions: rawCompanions } = body;
    const companions: string[] = Array.isArray(rawCompanions)
      ? [...new Set(rawCompanions.filter((id: unknown) => typeof id === "string" && id !== user_id))].slice(0, 20)
      : [];

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
        companions,
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
