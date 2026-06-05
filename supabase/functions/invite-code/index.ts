// supabase/functions/invite-code/index.ts
// Validates invite code and registers a user

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
    const { code, name } = await req.json();
    if (!code) return json({ error: "Missing invite code" }, 400);
    if (!name || !name.trim()) return json({ error: "Missing name" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate invite code
    const { data: inviteCode, error: codeErr } = await sb
      .from("invite_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (codeErr || !inviteCode) {
      return json({ error: "Invalid invite code" }, 404);
    }

    if (inviteCode.used_count >= inviteCode.max_uses) {
      return json({ error: "This invite code has reached its usage limit" }, 410);
    }

    // Check if name already exists (basic deduplication per team)
    const { data: existing } = await sb
      .from("users")
      .select("id")
      .eq("name", name.trim())
      .eq("team_id", inviteCode.team_id)
      .limit(1);

    if (existing && existing.length > 0) {
      const { data: existingUser } = await sb
        .from("users")
        .select("*")
        .eq("name", name.trim())
        .eq("team_id", inviteCode.team_id)
        .single();
      return json({ success: true, user: existingUser, already_registered: true });
    }

    // Create user
    const { data: user, error: userErr } = await sb
      .from("users")
      .insert({
        name: name.trim(),
        team_id: inviteCode.team_id,
        invite_code: inviteCode.code,
      })
      .select()
      .single();

    if (userErr) return json({ error: userErr.message }, 500);

    // Increment usage count
    await sb
      .from("invite_codes")
      .update({ used_count: inviteCode.used_count + 1 })
      .eq("id", inviteCode.id);

    return json({ success: true, user });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
