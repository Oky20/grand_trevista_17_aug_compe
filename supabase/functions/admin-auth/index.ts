// supabase/functions/admin-auth/index.ts
// Admin authentication + invite code management

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { action, password, code, team_id, max_uses, invite_code_id } = await req.json();

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── LOGIN ────────────────────────────────────────────
    if (action === "login") {
      if (!password) return json({ error: "Missing password" }, 400);

      const { data: authData, error: authErr } = await sb
        .from("admin_auth")
        .select("password_hash")
        .limit(1)
        .single();

      if (authErr || !authData) return json({ error: "Auth system not configured" }, 500);

      const inputHash = await sha256(password);
      if (inputHash !== authData.password_hash) {
        return json({ error: "Invalid password" }, 401);
      }

      return json({ success: true, token: inputHash.slice(0, 16) });
    }

    // ── LIST INVITE CODES ────────────────────────────────
    if (action === "list_codes") {
      const { data, error } = await sb
        .from("invite_codes")
        .select("*")
        .order("team_id")
        .order("code");
      if (error) return json({ error: error.message }, 500);
      return json({ codes: data });
    }

    // ── ADD INVITE CODE ──────────────────────────────────
    if (action === "add_code") {
      if (!code || !team_id) return json({ error: "Missing code or team_id" }, 400);
      const { data, error } = await sb
        .from("invite_codes")
        .insert({ code: code.trim().toUpperCase(), team_id, max_uses: max_uses || 50 })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, invite_code: data });
    }

    // ── RESET CODE USAGE ─────────────────────────────────
    if (action === "reset_code") {
      if (!invite_code_id) return json({ error: "Missing invite_code_id" }, 400);
      const { error } = await sb
        .from("invite_codes")
        .update({ used_count: 0 })
        .eq("id", invite_code_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ── DELETE CODE ──────────────────────────────────────
    if (action === "delete_code") {
      if (!invite_code_id) return json({ error: "Missing invite_code_id" }, 400);
      const { error } = await sb
        .from("invite_codes")
        .delete()
        .eq("id", invite_code_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
