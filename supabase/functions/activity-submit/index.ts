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
  "Run", "Walk", "Ride", "VirtualRide", "Swim",
  "Padel", "Tennis", "Badminton", "WeightTraining",
  "Workout", "Yoga", "Pilates", "Hike",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { user_id, name, sport_type, distance, moving_time, calories, start_date, image_path } = body;

    if (!user_id) return json({ error: "Missing user_id" }, 400);
    if (!start_date) return json({ error: "Missing start_date" }, 400);
    if (!sport_type || !VALID_SPORT_TYPES.includes(sport_type)) {
      return json({ error: `Invalid sport_type. Must be one of: ${VALID_SPORT_TYPES.join(", ")}` }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("DB_SERVICE_ROLE_KEY")!
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
