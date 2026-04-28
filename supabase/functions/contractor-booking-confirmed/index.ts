/**
 * contractor-booking-confirmed
 *
 * Handle contractor booking confirmation after Calendly redirect or webhook handoff.
 * Updates contractor CRM state and queues followup emails.
 *
 * POST body:
 *   lead_id: string (required)
 *   calendly_event_uri?: string | null
 *   calendly_invitee_uri?: string | null
 *   calendly_event_start?: string | null
 *   calendly_event_end?: string | null
 *
 * Auth: require x-contractor-secret header matching CONTRACTOR_CRON_SECRET env var.
 */

// deno-lint-ignore no-import-prefix
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
    console.error(
      "[contractor-booking-confirmed] CONTRACTOR_CRON_SECRET not set",
    );
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
    console.error("[contractor-booking-confirmed] Missing Supabase env vars");
    return json({ error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const {
    lead_id,
    calendly_event_uri,
    calendly_invitee_uri,
    calendly_event_start,
    calendly_event_end,
  } = body as {
    lead_id?: string;
    calendly_event_uri?: string | null;
    calendly_invitee_uri?: string | null;
    calendly_event_start?: string | null;
    calendly_event_end?: string | null;
  };

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
    console.error("[contractor-booking-confirmed] fetch lead error:", fetchErr);
    return json({ error: "Failed to fetch lead" }, 500);
  }

  if (!lead) {
    return json({ error: "Lead not found" }, 404);
  }

  const alreadyBooked = lead.booking_status === "booked";

  // 2. Update contractor_leads — only overwrite Calendly fields when values are provided
  const leadUpdate: Record<string, unknown> = {
    booking_status: "booked",
    pipeline_stage: "booked",
  };
  if (calendly_event_uri !== undefined) {
    leadUpdate.calendly_event_uri = calendly_event_uri;
  }
  if (calendly_invitee_uri !== undefined) {
    leadUpdate.calendly_invitee_uri = calendly_invitee_uri;
  }
  if (calendly_event_start !== undefined) {
    leadUpdate.calendly_event_start = calendly_event_start;
  }
  if (calendly_event_end !== undefined) {
    leadUpdate.calendly_event_end = calendly_event_end;
  }

  const { error: updateErr } = await supabase
    .from("contractor_leads")
    .update(leadUpdate)
    .eq("id", lead_id);

  if (updateErr) {
    console.error(
      "[contractor-booking-confirmed] update lead error:",
      updateErr,
    );
    return json({ error: "Failed to update lead" }, 500);
  }

  // 3. Insert activity log
  const { error: activityErr } = await supabase
    .from("contractor_activity_log")
    .insert({
      contractor_lead_id: lead_id,
      activity_type: "booking_created",
      activity_data: {
        calendly_event_uri: calendly_event_uri ?? null,
        calendly_invitee_uri: calendly_invitee_uri ?? null,
        calendly_event_start: calendly_event_start ?? null,
        calendly_event_end: calendly_event_end ?? null,
        was_already_booked: alreadyBooked,
      },
    });

  if (activityErr) {
    console.error(
      "[contractor-booking-confirmed] activity log error:",
      activityErr,
    );
    // Non-fatal — continue
  }

  // 4. Queue followup emails with idempotency checks (always check, regardless of alreadyBooked)
  const now = new Date();

  const followupsToInsert: Array<{
    contractor_lead_id: string;
    followup_type: string;
    scheduled_for: string;
    status: string;
    payload: Record<string, unknown>;
  }> = [];

  // confirmation_email — dedupe by (lead_id, followup_type) only, regardless of scheduled_for
  const confirmExists = await checkFollowupExistsByType(
    supabase,
    lead_id,
    "confirmation_email",
  );

  if (!confirmExists) {
    followupsToInsert.push({
      contractor_lead_id: lead_id,
      followup_type: "confirmation_email",
      scheduled_for: now.toISOString(),
      status: "pending",
      payload: {
        calendly_event_start: calendly_event_start ?? null,
        calendly_event_end: calendly_event_end ?? null,
      },
    });
  }

  // reminder_24h / reminder_1h — dedupe by (lead_id, followup_type, scheduled_for ±60s)
  if (calendly_event_start) {
    const eventStart = new Date(calendly_event_start);

    if (!isNaN(eventStart.getTime())) {
      const msUntilEvent = eventStart.getTime() - now.getTime();
      const MS_24H = 24 * 60 * 60 * 1000;
      const MS_1H = 60 * 60 * 1000;

      if (msUntilEvent > MS_24H) {
        const reminder24Scheduled = new Date(eventStart.getTime() - MS_24H)
          .toISOString();
        const exists24h = await checkFollowupExistsByTypeAndTime(
          supabase,
          lead_id,
          "reminder_24h",
          reminder24Scheduled,
        );

        if (!exists24h) {
          followupsToInsert.push({
            contractor_lead_id: lead_id,
            followup_type: "reminder_24h",
            scheduled_for: reminder24Scheduled,
            status: "pending",
            payload: {
              calendly_event_start: calendly_event_start,
              calendly_event_end: calendly_event_end ?? null,
            },
          });
        }
      }

      if (msUntilEvent > MS_1H) {
        const reminder1hScheduled = new Date(eventStart.getTime() - MS_1H)
          .toISOString();
        const exists1h = await checkFollowupExistsByTypeAndTime(
          supabase,
          lead_id,
          "reminder_1h",
          reminder1hScheduled,
        );

        if (!exists1h) {
          followupsToInsert.push({
            contractor_lead_id: lead_id,
            followup_type: "reminder_1h",
            scheduled_for: reminder1hScheduled,
            status: "pending",
            payload: {
              calendly_event_start: calendly_event_start,
              calendly_event_end: calendly_event_end ?? null,
            },
          });
        }
      }
    }
  }

  if (followupsToInsert.length > 0) {
    const { error: followupErr } = await supabase
      .from("contractor_followups")
      .insert(followupsToInsert);

    if (followupErr) {
      console.error(
        "[contractor-booking-confirmed] followup insert error:",
        followupErr,
      );
      // Non-fatal — return success but log
    }
  }

  return json({
    success: true,
    lead_id,
    booking_status: "booked",
    followups_queued: followupsToInsert.length,
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if ANY active (pending/sent/sending) followup of the given type exists for a lead.
 * Used for confirmation_email — dedupes by (lead_id, followup_type) regardless of time.
 */
async function checkFollowupExistsByType(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  followupType: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("contractor_followups")
    .select("id")
    .eq("contractor_lead_id", leadId)
    .eq("followup_type", followupType)
    .in("status", ["pending", "sent", "sending"])
    .limit(1);

  if (error) {
    console.error(
      "[contractor-booking-confirmed] checkFollowupExistsByType error:",
      error,
    );
    return false;
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Check if an active followup of the given type exists near a specific scheduled_for time (±60s).
 * Used for reminder_24h / reminder_1h — dedupes by (lead_id, followup_type, scheduled_for).
 */
async function checkFollowupExistsByTypeAndTime(
  supabase: ReturnType<typeof createClient>,
  leadId: string,
  followupType: string,
  scheduledFor: string,
): Promise<boolean> {
  const lower = new Date(new Date(scheduledFor).getTime() - 60_000)
    .toISOString();
  const upper = new Date(new Date(scheduledFor).getTime() + 60_000)
    .toISOString();

  const { data, error } = await supabase
    .from("contractor_followups")
    .select("id")
    .eq("contractor_lead_id", leadId)
    .eq("followup_type", followupType)
    .in("status", ["pending", "sent", "sending"])
    .gte("scheduled_for", lower)
    .lte("scheduled_for", upper)
    .limit(1);

  if (error) {
    console.error(
      "[contractor-booking-confirmed] checkFollowupExistsByTypeAndTime error:",
      error,
    );
    return false;
  }

  return (data?.length ?? 0) > 0;
}
