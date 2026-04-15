// supabase/functions/strava-sync/index.ts
// Fetches latest Strava activities for a given athlete_id
// Handles token refresh automatically

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { athlete_id } = await req.json();
    if (!athlete_id) return json({ error: "Missing athlete_id" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("DB_SERVICE_ROLE_KEY")!
    );

    // Fetch member record
    const { data: member, error: memberErr } = await sb
      .from("members")
      .select("*")
      .eq("strava_athlete_id", athlete_id)
      .single();

    if (memberErr || !member) return json({ error: "Member not found" }, 404);

    // Refresh token if expired
    let accessToken = member.access_token;
    const nowSec = Math.floor(Date.now() / 1000);

    if (member.token_expires_at < nowSec + 300) {
      const refreshRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id:     Deno.env.get("STRAVA_CLIENT_ID"),
          client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
          refresh_token: member.refresh_token,
          grant_type:    "refresh_token",
        }),
      });

      if (!refreshRes.ok) return json({ error: "Token refresh failed" }, 400);

      const refreshData = await refreshRes.json();
      accessToken = refreshData.access_token;

      // Update stored tokens
      await sb.from("members").update({
        access_token:     refreshData.access_token,
        refresh_token:    refreshData.refresh_token,
        token_expires_at: refreshData.expires_at,
      }).eq("strava_athlete_id", athlete_id);
    }

    // Fetch activities from Strava (challenge period)
    const challengeStart = Deno.env.get("CHALLENGE_START") || "";
    const afterTs = challengeStart
      ? Math.floor(new Date(challengeStart).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 86400 * 31;

    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${afterTs}&per_page=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!activitiesRes.ok) return json({ error: "Failed to fetch activities" }, 400);

    const activities = await activitiesRes.json();

    if (!activities.length) return json({ synced: 0 });

    // Map to our schema
    const rows = activities.map((a: any) => ({
      strava_activity_id: a.id,
      athlete_id:         athlete_id,
      name:               a.name,
      sport_type:         a.sport_type || a.type,
      distance:           a.distance,           // meters
      moving_time:        a.moving_time,         // seconds
      calories:           a.calories || 0,
      start_date:         a.start_date_local,
    }));

    // Upsert to Supabase
    const { error: upsertErr } = await sb
      .from("activities")
      .upsert(rows, { onConflict: "strava_activity_id" });

    if (upsertErr) return json({ error: upsertErr.message }, 500);

    return json({ synced: rows.length });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
