import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "unauthorized",
          message: "Missing auth token",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate user session
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Invalid session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = userData.user.id;

    // Parse and validate body
    const body = await req.json();
    const {
      service_counties,
      project_types,
      budget_bands,
      preferred_contact_method,
      schedule_notes,
      max_leads_per_week,
    } = body;

    if (!Array.isArray(service_counties) || service_counties.length === 0) {
      return new Response(
        JSON.stringify({
          error: "validation",
          message: "At least one service county is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!Array.isArray(project_types) || project_types.length === 0) {
      return new Response(
        JSON.stringify({
          error: "validation",
          message: "At least one project type is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Use service role to update contractors table (operator-gated)
    const svc = createClient(supabaseUrl, serviceRoleKey);

    // Resolve contractor by auth_user_id
    const { data: contractor, error: cErr } = await svc
      .from("contractors")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (cErr) throw cErr;

    if (!contractor) {
      return new Response(
        JSON.stringify({
          error: "not_found",
          message: "No contractor record linked to this account",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Update routing fields
    const { error: updateErr } = await svc
      .from("contractors")
      .update({
        service_counties: service_counties,
        project_types: project_types,
        budget_bands: Array.isArray(budget_bands) ? budget_bands : [],
        preferred_contact_method: typeof preferred_contact_method === "string"
          ? preferred_contact_method
          : null,
        schedule_notes: typeof schedule_notes === "string"
          ? schedule_notes.slice(0, 500)
          : null,
        max_leads_per_week:
          typeof max_leads_per_week === "number" && max_leads_per_week > 0
            ? max_leads_per_week
            : null,
        routing_setup_completed_at: new Date().toISOString(),
      })
      .eq("id", contractor.id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, contractor_id: contractor.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[save-routing-preferences] error:", err);
    return new Response(
      JSON.stringify({ error: "internal", message: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
