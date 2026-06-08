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
  "Badminton", "Tennis", "Padel", "Table Tennis",
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

const DHASH_THRESHOLD = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { user_id, name, sport_type, distance, moving_time, calories, start_date, image_path, image_hash, dhash } = body;

    if (!user_id) return json({ error: "Missing user_id" }, 400);
    if (!start_date) return json({ error: "Missing start_date" }, 400);
    if (!sport_type || !VALID_SPORT_TYPES.includes(sport_type)) {
      return json({ error: `Invalid sport_type. Must be one of: ${VALID_SPORT_TYPES.join(", ")}` }, 400);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for exact duplicate image (SHA-256)
    if (image_hash) {
      const { data: existingByHash } = await sb
        .from("activities")
        .select("id")
        .eq("image_hash", image_hash)
        .limit(1);
      if (existingByHash && existingByHash.length > 0) {
        return json({ error: "This image has already been submitted (exact match)." }, 409);
      }
    }

    // Check for perceptual duplicate (dHash)
    if (dhash) {
      const { data: existingDh } = await sb
        .from("activities")
        .select("id, dhash")
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

    // Check for duplicate activity (same user, date, sport, similar distance)
    const { data: existingByCombo } = await sb
      .from("activities")
      .select("id, distance")
      .eq("user_id", user_id)
      .eq("start_date", start_date)
      .eq("sport_type", sport_type)
      .limit(5);

    if (existingByCombo && existingByCombo.length > 0) {
      const dist = (distance || 0) as number;
      const closeMatch = existingByCombo.find((a: { distance: number }) =>
        Math.abs((a.distance || 0) - dist) < 2
      );
      if (closeMatch) {
        return json({ error: "Duplicate activity detected — same user, date, sport, and distance." }, 409);
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
