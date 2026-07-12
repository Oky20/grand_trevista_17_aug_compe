// supabase/functions/activity-delete/index.ts
// Deletes an activity after verifying the requester owns it and it's within
// the deletion window. Mirrors activity-submit's trust model: the client
// sends user_id, but ownership is verified server-side against the DB.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const TIMEZONE = "Asia/Jakarta";
const DELETE_WINDOW_DAYS = 7; // same window as activity-submit's SUBMIT_WINDOW_DAYS

function jakartaDateKey(dateInput: string | number | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(dateInput));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const { activity_id, user_id } = body;

    if (!activity_id) return json({ error: "Missing activity_id" }, 400);
    if (!user_id) return json({ error: "Missing user_id" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: activity, error: fetchError } = await sb
      .from("activities")
      .select("id, user_id, start_date")
      .eq("id", activity_id)
      .single();

    if (fetchError || !activity) return json({ error: "Activity not found" }, 404);
    if (activity.user_id !== user_id) {
      return json({ error: "You can only delete your own activities." }, 403);
    }

    const activityDay = jakartaDateKey(activity.start_date);
    const todayDay = jakartaDateKey(new Date());
    const daysSince = (Date.parse(todayDay) - Date.parse(activityDay)) / 86400000;
    if (daysSince > DELETE_WINDOW_DAYS) {
      return json({ error: `Deletion window closed — activities can only be deleted within ${DELETE_WINDOW_DAYS} days of the activity date.` }, 400);
    }

    const { error: deleteError } = await sb
      .from("activities")
      .delete()
      .eq("id", activity_id);

    if (deleteError) return json({ error: deleteError.message }, 500);

    return json({ success: true });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
