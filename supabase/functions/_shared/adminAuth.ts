/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN AUTHENTICATION v2.0 - RBAC Edition
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * UPGRADE FROM v1:
 *   - Replaces binary admin/not-admin with granular role checks
 *   - Supports: super_admin, operator, viewer
 *   - Backward compatible: validateAdminRequest() still works for all
 *     existing edge functions (defaults to requiring operator+)
 *   - New: validateAdminRequestWithRole() for specific role requirements
 *
 * ROLE HIERARCHY:
 *   super_admin > operator > viewer
 *   - super_admin: Full access. Can manage roles, delete data, view financials.
 *   - operator: Can update leads, manage opportunities, trigger voice calls.
 *   - viewer: Read-only dashboard access. Cannot trigger write operations.
 *
 * USAGE (existing — unchanged):
 * ```typescript
 * import { validateAdminRequest, corsHeaders } from "../_shared/adminAuth.ts";
 *
 * const validation = await validateAdminRequest(req);
 * if (!validation.ok) return validation.response;
 * const { email, userId, role, supabaseAdmin } = validation;
 * ```
 *
 * USAGE (new — role-specific):
 * ```typescript
 * import { validateAdminRequestWithRole, corsHeaders } from "../_shared/adminAuth.ts";
 *
 * // Only super_admins can access this endpoint
 * const validation = await validateAdminRequestWithRole(req, ['super_admin']);
 * if (!validation.ok) return validation.response;
 * ```
 */

import {
  createClient,
  SupabaseClient,
  // deno-lint-ignore no-import-prefix
} from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ═══════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

/** Matches the app_role ENUM in PostgreSQL */
export type AppRole = "super_admin" | "operator" | "viewer";

/** Roles that grant admin-level access (used by default validation) */
const ADMIN_ROLES: AppRole[] = ["super_admin", "operator"];

/** All valid role values for type checking */
const ALL_ROLES: AppRole[] = ["super_admin", "operator", "viewer"];

interface ValidationSuccess {
  ok: true;
  email: string;
  userId: string;
  role: AppRole;
  supabaseAdmin: SupabaseClient;
  supabaseAuth: SupabaseClient;
}

interface ValidationFailure {
  ok: false;
  response: Response;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// ═══════════════════════════════════════════════════════════════════════════
// CORS Headers — Standard for all admin endpoints
// ═══════════════════════════════════════════════════════════════════════════

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dev-secret",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ═══════════════════════════════════════════════════════════════════════════
// Response Helpers
// ═══════════════════════════════════════════════════════════════════════════

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      code,
      error: message,
      details: details || null,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export function successResponse(
  data: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      timestamp: new Date().toISOString(),
      ...data,
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Role Check — Database-driven via user_roles table
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieve the application's role for a user by their user ID.
 *
 * Uses the provided service-role Supabase client to read the `user_roles` table and determine the user's role. If the stored role is the legacy string `"admin"`, it is mapped to `"super_admin"`. Unknown roles, missing role rows, or database errors result in `null`.
 *
 * @param supabaseAdmin - Supabase client instantiated with the service role key (bypasses RLS)
 * @param userId - The authenticated user's ID (matches `user_roles.id`)
 * @returns The user's `AppRole` if recognized (legacy `"admin"` mapped to `"super_admin"`), or `null` if no valid role is found or an error occurs
 */
async function getUserRole(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<AppRole | null> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[adminAuth] Error fetching user role:", error.message);
    return null;
  }

  if (!data?.role) return null;

  // Validate the role is one we recognize
  const role = data.role as string;
  if (ALL_ROLES.includes(role as AppRole)) {
    return role as AppRole;
  }

  // Legacy 'admin' value → treat as super_admin (safety net during migration)
  if (role === "admin") {
    console.warn(
      `[adminAuth] User ${userId} still has legacy 'admin' role. ` +
        `Run migration to upgrade to 'super_admin'.`,
    );
    return "super_admin";
  }

  console.warn(`[adminAuth] Unknown role '${role}' for user ${userId}`);
  return null;
}

/**
 * Legacy compatibility: Check if user has admin-level access.
 * @deprecated Use getUserRole() + role check instead
 */
export async function hasAdminRole(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const role = await getUserRole(supabaseAdmin, userId);
  return role !== null && ADMIN_ROLES.includes(role);
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Validation Logic (shared between both entry points)
// ═══════════════════════════════════════════════════════════════════════════

async function validateAndExtractUser(
  req: Request,
  requiredRoles: AppRole[],
): Promise<ValidationResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Check environment configuration
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error("[adminAuth] Missing Supabase credentials");
    return {
      ok: false,
      response: errorResponse(
        500,
        "config_error",
        "Server configuration error",
      ),
    };
  }

  // ── DEV BYPASS: Check X-Dev-Secret header ──────────────────────────
  const normalizeSecretValue = (value: string | null): string | null =>
    value ? value.trim().replace(/^['"]+|['"]+$/g, "") : null;

  const devSecretRaw = req.headers.get("x-dev-secret");
  const expectedDevSecretRaw = Deno.env.get("DEV_BYPASS_SECRET");
  const devSecret = normalizeSecretValue(devSecretRaw);
  const expectedDevSecret = normalizeSecretValue(expectedDevSecretRaw ?? null);

  // Diagnostic logging (never logs actual secret values)
  console.log("[adminAuth] Dev bypass check:", {
    headerPresent: !!devSecretRaw,
    envPresent: !!expectedDevSecretRaw,
    headerLen: devSecret?.length ?? 0,
    envLen: expectedDevSecret?.length ?? 0,
    match: devSecret !== null && devSecret === expectedDevSecret,
  });

  if (devSecretRaw) {
    // Header was sent — resolve bypass decisively (never fall through to JWT)
    if (!expectedDevSecret) {
      console.error(
        "[adminAuth] DEV BYPASS FAIL: DEV_BYPASS_SECRET env var is not set on server",
      );
      return {
        ok: false,
        response: errorResponse(
          500,
          "config_error",
          "Server missing DEV_BYPASS_SECRET",
        ),
      };
    }
    if (devSecret !== expectedDevSecret) {
      console.error(
        "[adminAuth] DEV BYPASS FAIL: secret mismatch (lengths: header=" +
          (devSecret?.length ?? 0) + " env=" + expectedDevSecret.length + ")",
      );
      return {
        ok: false,
        response: errorResponse(
          401,
          "dev_bypass_mismatch",
          "Dev bypass secret does not match server",
        ),
      };
    }
    // Match — grant super_admin
    console.log("[adminAuth] DEV BYPASS GRANTED: super_admin");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    return {
      ok: true,
      email: "dev-sandbox@windowman.app",
      userId: "dev-sandbox-bypass",
      role: "super_admin",
      supabaseAdmin,
      supabaseAuth,
    };
  }

  // Extract bearer token
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: errorResponse(
        401,
        "unauthorized",
        "Missing or invalid Authorization header",
      ),
    };
  }

  const token = authHeader.slice(7);
  if (!token) {
    return {
      ok: false,
      response: errorResponse(401, "unauthorized", "Missing bearer token"),
    };
  }

  // Create dual clients: auth client for validation, admin for DB operations
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Validate JWT using getUser() — the correct supabase-js v2 API
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(
    token,
  );

  if (userError || !userData?.user) {
    console.error(
      "[adminAuth] JWT validation failed:",
      userError?.message,
    );
    return {
      ok: false,
      response: errorResponse(
        401,
        "invalid_token",
        "Invalid or expired token",
      ),
    };
  }

  const email = userData.user.email as string | undefined;
  const userId = userData.user.id as string;

  if (!email) {
    return {
      ok: false,
      response: errorResponse(
        401,
        "no_email",
        "Token does not contain email claim",
      ),
    };
  }

  // Fetch and validate role
  const role = await getUserRole(supabaseAdmin, userId);

  if (!role) {
    console.warn(
      `[adminAuth] No role found for user ${email} (${userId})`,
    );
    return {
      ok: false,
      response: errorResponse(
        403,
        "no_role",
        "No role assigned. Contact a super_admin to request access.",
      ),
    };
  }

  if (!requiredRoles.includes(role)) {
    console.warn(
      `[adminAuth] Insufficient permissions for ${email}: ` +
        `has '${role}', needs one of [${requiredRoles.join(", ")}]`,
    );
    return {
      ok: false,
      response: errorResponse(
        403,
        "insufficient_role",
        `This action requires one of: ${
          requiredRoles.join(", ")
        }. Your role: ${role}`,
        { userRole: role, requiredRoles },
      ),
    };
  }

  return {
    ok: true,
    email: email.toLowerCase(),
    userId,
    role,
    supabaseAdmin,
    supabaseAuth,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API — Validation Entry Points
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate an admin request. Requires 'operator' or 'super_admin' role.
 *
 * This is the BACKWARD-COMPATIBLE entry point. All existing edge functions
 * that import validateAdminRequest will continue to work unchanged.
 *
 * @param req - The incoming request
 * @returns ValidationResult with role information on success
 */
// deno-lint-ignore require-await
export async function validateAdminRequest(
  req: Request,
): Promise<ValidationResult> {
  return validateAndExtractUser(req, ADMIN_ROLES);
}

/**
 * Validate an admin request with SPECIFIC role requirements.
 *
 * Use this for endpoints that need fine-grained access control.
 *
 * @param req - The incoming request
 * @param requiredRoles - Array of roles that can access this endpoint
 * @returns ValidationResult with role information on success
 *
 * @example
 * // Only super_admins can manage roles
 * const v = await validateAdminRequestWithRole(req, ['super_admin']);
 *
 * @example
 * // All admin roles including viewer (read-only dashboards)
 * const v = await validateAdminRequestWithRole(req, ['super_admin', 'operator', 'viewer']);
 */
// deno-lint-ignore require-await
export async function validateAdminRequestWithRole(
  req: Request,
  requiredRoles: AppRole[],
): Promise<ValidationResult> {
  return validateAndExtractUser(req, requiredRoles);
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility: Hard-fail helper for DB queries (consistent pattern)
// ═══════════════════════════════════════════════════════════════════════════

export function assertNoError(
  error: unknown,
  context: string,
): asserts error is null {
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[adminAuth] HARD-FAIL in ${context}:`, msg);
    throw new Error(`Database query failed in ${context}: ${msg}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility: Role hierarchy check
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_HIERARCHY: Record<AppRole, number> = {
  super_admin: 100,
  operator: 50,
  viewer: 10,
};

/**
 * Check if roleA outranks roleB in the hierarchy.
 * Useful for preventing operators from promoting themselves to super_admin.
 */
export function roleOutranks(roleA: AppRole, roleB: AppRole): boolean {
  return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
}

/**
 * Check if a role meets or exceeds a minimum required level.
 */
export function roleMeetsMinimum(
  userRole: AppRole,
  minimumRole: AppRole,
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}
