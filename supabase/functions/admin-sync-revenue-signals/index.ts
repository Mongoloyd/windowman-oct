import { z } from "https://esm.sh/zod@3.23.8";
import { corsHeaders, errorResponse, successResponse, validateAdminRequestWithRole } from "../_shared/adminAuth.ts";

const BodySchema = z.object({
  dry_run: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(500).optional().default(100),
}).strict();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(405, "method_not_allowed", "Only POST is allowed.");

  const validation = await validateAdminRequestWithRole(req, ["super_admin", "operator"]);
  if (!validation.ok) return validation.response;

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (error) {
    return errorResponse(400, "invalid_request", "Invalid revenue signal sync request.", {
      issues: error instanceof z.ZodError ? error.flatten().fieldErrors : undefined,
    });
  }

  const { data, error } = await validation.supabaseAuth.rpc("admin_sync_revenue_signals", {
    p_limit: parsed.limit,
    p_dry_run: parsed.dry_run,
  });

  if (error) {
    return errorResponse(500, "sync_failed", "Revenue signal sync failed.", { message: error.message });
  }

  const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return successResponse({
    ...result,
    ok: result.ok !== false,
    dry_run: parsed.dry_run,
    external_dispatch: false,
    dispatch_created: false,
  });
});
