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
  contactName: z.string().trim().min(1, "missing_contact_name").max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  serviceArea: z.string().trim().max(500).optional().nullable(),
  website: z.string().trim().max(255).optional().nullable(),
  licenseNumber: z.string().trim().max(120).optional().nullable(),
  monthlyCapacity: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
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

  const {
    companyName,
    email,
    password,
    contactName,
    phone,
    serviceArea,
    website,
    licenseNumber,
    monthlyCapacity,
    notes,
  } = parsed.data;

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
  const { data: createdUser, error: createErr } = await admin.auth.admin
    .createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        company_name: companyName,
        contact_name: contactName,
        phone: phone ?? null,
        service_area: serviceArea ?? null,
        website: website ?? null,
        license_number: licenseNumber ?? null,
        monthly_capacity: monthlyCapacity ?? null,
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

  await admin.from("contractor_accounts").insert({
    auth_user_id: userId,
    client_slug: "direct",
    display_name: companyName,
    contact_email: email,
    contact_phone: phone ?? null,
    access_status: "pending",
    is_active: false,
    portal_role: "contractor_owner",
    territory: {
      service_area: serviceArea ?? null,
      website: website ?? null,
      license_number: licenseNumber ?? null,
      monthly_capacity: monthlyCapacity ?? null,
      notes: notes ?? null,
    },
    metadata: {
      source: "partner_self_serve",
      contact_name: contactName,
      submitted_at: new Date().toISOString(),
    },
  }).then(({ error }) => {
    if (error) {
      console.warn(
        "[request-partner-access] contractor_account insert skipped",
        error.message,
      );
    }
  });

  // 3. Best-effort ops audit log (non-fatal)
  try {
    await admin.from("event_logs").insert({
      user_id: userId,
      event_name: "partner_access_requested",
      flow_type: "partner_self_serve",
      route: "/partner/join",
      metadata: {
        company_name: companyName,
        contact_name: contactName,
        email_masked: maskEmail(email),
        phone_present: Boolean(phone),
        service_area: serviceArea ?? null,
        monthly_capacity: monthlyCapacity ?? null,
        status: "pending_review",
      },
    });
  } catch (e) {
    console.warn("[request-partner-access] audit log skipped", e);
  }

  await notifyOps({
    companyName,
    contactName,
    email,
    phone: phone ?? null,
    serviceArea: serviceArea ?? null,
    website: website ?? null,
    licenseNumber: licenseNumber ?? null,
    monthlyCapacity: monthlyCapacity ?? null,
    notes: notes ?? null,
  });

  return json(200, {
    ok: true,
    user_id: userId,
    status: "pending_review",
  });
});

async function notifyOps(details: Record<string, string | null>) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("CONTRACTOR_EMAIL");
  if (!resendKey || !to) {
    console.warn(
      "[request-partner-access] ops email skipped; RESEND_API_KEY or CONTRACTOR_EMAIL missing",
    );
    return;
  }

  const rows = Object.entries(details)
    .map(([key, value]) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">${key}</td><td style="padding:4px 0;color:#0f172a;">${
        escapeHtml(value || "—")
      }</td></tr>`
    )
    .join("");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "WindowMan <onboarding@resend.dev>",
        to: [to],
        subject: `New partner access request: ${details.companyName}`,
        html:
          `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;"><h2>New partner access request</h2><table>${rows}</table></div>`,
      }),
    });
    if (!res.ok) {
      console.warn(
        "[request-partner-access] ops email rejected",
        await res.text(),
      );
    }
  } catch (e) {
    console.warn("[request-partner-access] ops email failed", e);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
