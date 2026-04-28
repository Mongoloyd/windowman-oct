import { corsHeaders } from "../_shared/adminAuth.ts";
// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * accept-invite — Validates an invitation token, links the authenticated
 * user to the contractor business record, provisions contractor_profiles
 * and seeds credits if specified.
 *
 * POST { invite_token: string }
 * Requires: Authorization header with a valid user JWT
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // 1. Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { error: "Missing Authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser(
      token,
    );
    if (userErr || !user) {
      return json(401, { error: "Invalid or expired session" });
    }

    // 2. Parse body
    const body = await req.json();
    const inviteToken = (body.invite_token ?? "").trim();
    if (!inviteToken) {
      return json(400, { error: "invite_token is required" });
    }

    // 3. Service-role client for privileged ops
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 4. Look up invitation
    const { data: invite, error: invErr } = await admin
      .from("contractor_invitations")
      .select("*")
      .eq("invite_token", inviteToken)
      .maybeSingle();

    if (invErr || !invite) {
      return json(404, { error: "Invitation not found" });
    }

    if (invite.status !== "pending") {
      return json(409, { error: `Invitation already ${invite.status}` });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await admin.from("contractor_invitations")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return json(410, { error: "Invitation has expired" });
    }

    // 5. Validate email match
    if (user.email?.toLowerCase() !== invite.invited_email.toLowerCase()) {
      return json(403, {
        error:
          "This invitation was sent to a different email address. Please sign in with the invited email.",
      });
    }

    // 6. Check if auth_user_id is already linked to a different contractor
    const { data: existingBridge } = await admin
      .from("contractors")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (existingBridge && existingBridge.id !== invite.contractor_id) {
      return json(409, {
        error: "Your account is already linked to a different contractor.",
      });
    }

    // 7. Link auth user to the contractor business record
    const { error: bridgeErr } = await admin
      .from("contractors")
      .update({ auth_user_id: user.id })
      .eq("id", invite.contractor_id);

    if (bridgeErr) {
      console.error("[accept-invite] bridge update failed:", bridgeErr.message);
      return json(500, { error: "Failed to link account" });
    }

    // 8. Upsert contractor_profiles row
    const { error: profileErr } = await admin
      .from("contractor_profiles")
      .upsert({
        id: user.id,
        company_name: invite.invited_email, // will be updated by admin
        contact_email: invite.invited_email,
        status: "active",
      }, { onConflict: "id" });

    if (profileErr) {
      console.error(
        "[accept-invite] profile upsert failed:",
        profileErr.message,
      );
    }

    // 9. Seed credits if specified
    if (invite.initial_credits > 0) {
      const { error: creditErr } = await admin.rpc(
        "admin_adjust_contractor_credits",
        {
          p_contractor_id: user.id,
          p_delta: invite.initial_credits,
          p_entry_type: "seed",
          p_notes: `Invitation seed: ${invite.initial_credits} credits`,
          p_admin_user_id: invite.created_by,
        },
      );
      if (creditErr) {
        console.error("[accept-invite] credit seed failed:", creditErr.message);
      }
    }

    // 10. Mark invitation as accepted
    await admin.from("contractor_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq("id", invite.id);

    return json(200, {
      success: true,
      contractor_id: invite.contractor_id,
      credits_seeded: invite.initial_credits,
    });
  } catch (err) {
    console.error("[accept-invite] Error:", err);
    return json(500, { error: "Internal server error" });
  }
});

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
