// supabase/functions/send-invite/index.ts
// Deploy with: supabase functions deploy send-invite

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── 1. Verify the caller is authenticated and is a super_admin ────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    console.log(
      "auth user:",
      JSON.stringify(user),
      "error:",
      JSON.stringify(userError),
    );
    if (userError || !user)
      return json({ error: "Unauthorized", detail: userError?.message }, 401);

    const { data: profile, error: profileError } = await callerClient
      .from("staff_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    console.log(
      "profile:",
      JSON.stringify(profile),
      "error:",
      JSON.stringify(profileError),
    );
    if (profileError || !profile)
      return json(
        { error: "No staff profile found", detail: profileError?.message },
        403,
      );
    if (profile.role !== "super_admin")
      return json(
        { error: "Super admin access required", role: profile.role },
        403,
      );

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    const { email, display_name, role = "agent" } = await req.json();
    if (!email || !display_name)
      return json({ error: "email and display_name are required" }, 400);

    const adminUrl = Deno.env.get("ADMIN_BASE_URL") ?? "http://localhost:3003";

    // ── 3. Send invite via service role client ────────────────────────────────
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${adminUrl}/accept-invite`,
      });

    if (inviteError) {
      console.error("Invite error:", inviteError);
      return json({ error: inviteError.message }, 502);
    }

    // ── 4. Write invite record ────────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: dbError } = await adminClient
      .from("invites")
      .insert({
        email,
        display_name,
        role,
        invited_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return json({ error: dbError.message }, 500);
    }

    return json({ ok: true, invite });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
