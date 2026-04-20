/**
 * request-partner-access — Public self-serve partner registration.
 *
 * Creates a Supabase auth user + a `contractor_profiles` row with
 * `status = 'pending_review'`. PartnerGuard blocks access until an
 * operator flips status to 'active'.
 *
 * Public (verify_jwt = false). Uses service role on the server only.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  companyName: z.string().trim().min(1, "missing_company").max(200),
  email: z.string().trim().toLowerCase().email("invalid_email").max(255),
  password: z.string().min(8, "weak_password").max(128),
  contactName: z.string().trim().max(200).optional().nullable(),
});

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error_code: "method_not_allowed" });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { ok: false, error_code: "invalid_json" });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const code = firstIssue?.message ?? "invalid_input";
    return json(400, {
      ok: false,
      error_code: code,
      message: firstIssue?.message ?? "Invalid input",
      field: firstIssue?.path?.[0] ?? null,
    });
  }

  const { companyName, email, password, contactName } = parsed.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[request-partner-access] missing service env");
    return json(500, { ok: false, error_code: "internal_error" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Create auth user
  const { data: createdUser, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        company_name: companyName,
        contact_name: contactName ?? null,
        partner_self_serve: true,
      },
    });

  if (createErr || !createdUser?.user) {
    const msg = (createErr?.message ?? "").toLowerCase();
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists") ||
      msg.includes("duplicate")
    ) {
      return json(409, {
        ok: false,
        error_code: "email_taken",
        message: "This email is already registered.",
      });
    }
    if (msg.includes("password")) {
      return json(400, {
        ok: false,
        error_code: "weak_password",
        message: "Password is too weak.",
      });
    }
    if (msg.includes("email") || msg.includes("invalid")) {
      return json(400, {
        ok: false,
        error_code: "invalid_email",
        message: "Invalid email address.",
      });
    }
    console.error("[request-partner-access] createUser error", createErr);
    return json(500, { ok: false, error_code: "internal_error" });
  }

  const userId = createdUser.user.id;

  // 2. Insert contractor_profiles row (service role bypasses RLS)
  const { error: profileErr } = await admin.from("contractor_profiles").insert({
    id: userId,
    company_name: companyName,
    contact_email: email,
    status: "pending_review",
  });

  if (profileErr) {
    console.error(
      "[request-partner-access] profile insert failed, rolling back auth user",
      profileErr,
    );
    // Rollback: delete the orphan auth user
    await admin.auth.admin.deleteUser(userId).catch((e) =>
      console.error("[request-partner-access] rollback deleteUser failed", e)
    );
    return json(500, {
      ok: false,
      error_code: "internal_error",
      message: "Could not create partner profile.",
      debug: {
        code: (profileErr as { code?: string }).code ?? null,
        message: profileErr.message ?? null,
      },
    });
  }

  // 3. Best-effort ops audit log (non-fatal)
  try {
    await admin.from("lead_events").insert({
      lead_id: userId, // table requires non-null; use the new user id as the subject
      event_name: "partner_access_requested",
      event_source: "partner_self_serve",
      metadata: {
        company_name: companyName,
        contact_name: contactName ?? null,
        email_masked: maskEmail(email),
        status: "pending_review",
      },
    });
  } catch (e) {
    console.warn("[request-partner-access] audit log skipped", e);
  }

  return json(200, {
    ok: true,
    user_id: userId,
    status: "pending_review",
  });
});
