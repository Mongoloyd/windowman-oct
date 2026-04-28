/**
 * contractor-mark-no-show
 *
 * Mark a contractor booking as a no-show and queue the recovery followup.
 *
 * POST body:
 *   lead_id: string (required)
 *
 * Auth: require x-contractor-secret header matching CONTRACTOR_CRON_SECRET env var.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-contractor-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Verify the shared secret header. Returns an error Response or null on success. */
function verifySecret(req: Request): Response | null {
  const cronSecret = Deno.env.get("CONTRACTOR_CRON_SECRET");
  if (!cronSecret) {
    console.error("[contractor-mark-no-show] CONTRACTOR_CRON_SECRET not set");
    return json({ error: "Server configuration error" }, 500);
  }
  const provided = req.headers.get("x-contractor-secret");
  if (!provided || provided !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Authenticate
  const authErr = verifySecret(req);
  if (authErr) return authErr;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[contractor-mark-no-show] Missing Supabase env vars");
    return json({ error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { lead_id } = body as { lead_id?: string };

  if (!lead_id || typeof lead_id !== "string") {
    return json({ error: "lead_id is required" }, 400);
  }

  // 1. Fetch contractor_leads row
  const { data: lead, error: fetchErr } = await supabase
    .from("contractor_leads")
    .select("id, booking_status")
    .eq("id", lead_id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[contractor-mark-no-show] fetch lead error:", fetchErr);
    return json({ error: "Failed to fetch lead" }, 500);
  }

  if (!lead) {
    return json({ error: "Lead not found" }, 404);
  }

  // 2. Idempotency: check for an existing active no_show_followup regardless of
  //    current booking_status. This prevents duplicate followups from concurrent
  //    requests that both see the lead in its original state before the update.
  const { data: existing, error: existErr } = await supabase
    .from("contractor_followups")
    .select("id")
    .eq("contractor_lead_id", lead_id)
    .eq("followup_type", "no_show_followup")
    .in("status", ["pending", "sent", "sending"])
    .limit(1);

  if (existErr) {
    console.error(
      "[contractor-mark-no-show] idempotency check error:",
      existErr,
    );
  }

  if (existing && existing.length > 0) {
    // Already handled — return success without duplicating
    return json({
      success: true,
      lead_id,
      booking_status: "no_show",
      followup_queued: false,
      idempotent: true,
    });
  }

  // 3. Update booking_status to no_show
  const { error: updateErr } = await supabase
    .from("contractor_leads")
    .update({ booking_status: "no_show" })
    .eq("id", lead_id);

  if (updateErr) {
    console.error("[contractor-mark-no-show] update lead error:", updateErr);
    return json({ error: "Failed to update lead" }, 500);
  }

  // 4. Insert activity log
  const { error: activityErr } = await supabase
    .from("contractor_activity_log")
    .insert({
      contractor_lead_id: lead_id,
      activity_type: "no_show",
      activity_data: {
        previous_booking_status: lead.booking_status,
        marked_at: new Date().toISOString(),
      },
    });

  if (activityErr) {
    console.error("[contractor-mark-no-show] activity log error:", activityErr);
    // Non-fatal — continue
  }

  // 5. Queue no_show_followup
  const { error: followupErr } = await supabase
    .from("contractor_followups")
    .insert({
      contractor_lead_id: lead_id,
      followup_type: "no_show_followup",
      scheduled_for: new Date().toISOString(),
      status: "pending",
      payload: {},
    });

  if (followupErr) {
    console.error(
      "[contractor-mark-no-show] followup insert error:",
      followupErr,
    );
    return json({ error: "Failed to queue followup" }, 500);
  }

  return json({
    success: true,
    lead_id,
    booking_status: "no_show",
    followup_queued: true,
    idempotent: false,
  });
});
