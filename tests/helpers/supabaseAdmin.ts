/**
 * Node-only Supabase admin client for Playwright DB assertions.
 *
 * STRICT BOUNDARY:
 * - This module MUST NEVER be imported from `src/`. It is consumed only by
 *   files under `tests/` that run inside the Playwright Node process.
 * - The service-role secret is read from `process.env.SUPABASE_SERVICE_ROLE_KEY`.
 *   It MUST NOT be exposed via `VITE_*`, never bundled, never sent to the
 *   browser. The Playwright runner is a Node process — the secret stays there.
 * - When the secret is absent (e.g. local dev without prod credentials), the
 *   helper returns null and tests skip cleanly with a single explanatory log.
 *   This keeps the suite safe-by-default for contributors without prod access
 *   and only enforces assertions in CI where the secret is configured.
 *
 * Production RLS posture is unchanged. No public surface is widened.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let cached: SupabaseClient | null | undefined;

/**
 * Returns the admin client, or null if the service-role key is not configured.
 * Tests should treat null as "skip with reason".
 */
export function getAdminClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    cached = null;
    return null;
  }
  cached = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const SKIP_REASON =
  "SUPABASE_SERVICE_ROLE_KEY (and SUPABASE_URL) must be set in the Playwright Node env to run cold-session DB smokes. Skipping.";

// ── Minimal, narrowly-scoped read helpers ─────────────────────────────────
// Each helper returns the smallest shape the smokes need. They never widen
// access beyond what the smoke under test explicitly requires.

export type LeadRow = {
  id: string;
  email: string | null;
  phone_e164: string | null;
  session_id: string | null;
  source: string | null;
};

export type PartnerProfileRow = {
  id: string;
  company_name: string;
  contact_email: string;
  status: string;
};

export type ContractorAccountRow = {
  id: string;
  auth_user_id: string | null;
  client_slug: string;
  display_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  access_status: string;
  is_active: boolean;
  portal_role: string;
  territory: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export async function getLeadByEmail(email: string): Promise<LeadRow | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("leads")
    .select("id, email, phone_e164, session_id, source")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as LeadRow | null) ?? null;
}

export async function getQuoteFilesForLead(leadId: string): Promise<{ count: number; firstId: string | null }> {
  const admin = getAdminClient();
  if (!admin) return { count: 0, firstId: null };
  const { data, error } = await admin
    .from("quote_files")
    .select("id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { count: data?.length ?? 0, firstId: (data?.[0]?.id as string | null) ?? null };
}

export async function getScanSessionsForLead(leadId: string): Promise<{ count: number; firstId: string | null }> {
  const admin = getAdminClient();
  if (!admin) return { count: 0, firstId: null };
  const { data, error } = await admin
    .from("scan_sessions")
    .select("id, status")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { count: data?.length ?? 0, firstId: (data?.[0]?.id as string | null) ?? null };
}

export async function getPartnerProfileByEmail(email: string): Promise<PartnerProfileRow | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("contractor_profiles")
    .select("id, company_name, contact_email, status")
    .eq("contact_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PartnerProfileRow | null) ?? null;
}

export async function getContractorAccountByEmail(email: string): Promise<ContractorAccountRow | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("contractor_accounts")
    .select("id, auth_user_id, client_slug, display_name, contact_email, contact_phone, access_status, is_active, portal_role, territory, metadata")
    .eq("contact_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ContractorAccountRow | null) ?? null;
}

/**
 * Best-effort cleanup of test rows by email pattern. Never blocks the test —
 * if cleanup fails the next run still uses unique emails so assertions stay
 * deterministic. Only deletes rows whose email matches the smoke prefix.
 */
export async function cleanupTestLead(email: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  if (!email.startsWith("wm-smoke-")) return; // safety: only touch smoke rows
  try {
    const lead = await getLeadByEmail(email);
    if (!lead) return;
    await admin.from("scan_sessions").delete().eq("lead_id", lead.id);
    await admin.from("quote_files").delete().eq("lead_id", lead.id);
    await admin.from("leads").delete().eq("id", lead.id);
  } catch {
    // intentionally swallowed — cleanup is best-effort
  }
}

/**
 * Best-effort cleanup for partner join E2E rows. Restricted to the dedicated
 * partner E2E email prefix so this helper can never delete real operator data.
 */
export async function cleanupTestPartnerAccount(email: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;
  if (!email.startsWith("wm-partner-e2e-")) return;

  try {
    const profile = await getPartnerProfileByEmail(email);
    const account = await getContractorAccountByEmail(email);
    const authUserId = profile?.id ?? account?.auth_user_id ?? null;

    await admin.from("contractor_accounts").delete().eq("contact_email", email);
    await admin.from("contractor_profiles").delete().eq("contact_email", email);

    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId);
    }
  } catch {
    // intentionally swallowed — unique test emails keep retries deterministic
  }
}
