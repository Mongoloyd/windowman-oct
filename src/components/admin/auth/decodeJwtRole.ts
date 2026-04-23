/**
 * decodeJwtRole — single source of truth for reading the admin role
 * from a Supabase access token.
 *
 * Reads `app_metadata.role` (the value `is_internal_operator()` checks
 * server-side). Falls back to a top-level `role` claim only as a courtesy.
 *
 * Returns null for any unrecognized / missing role so callers can treat
 * "no role" as "not authorized" without ambiguity.
 */

export type JwtRole = "super_admin" | "admin" | "operator" | "viewer" | null;

export const ADMIN_ROLES: ReadonlyArray<Exclude<JwtRole, null>> = [
  "operator",
  "admin",
  "super_admin",
];

export function decodeJwtRole(accessToken: string | undefined | null): JwtRole {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    const role = json?.app_metadata?.role ?? json?.role ?? null;
    if (
      role === "super_admin" ||
      role === "admin" ||
      role === "operator" ||
      role === "viewer"
    ) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug("[admin-auth] decoded role:", role);
      }
      return role;
    }
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[admin-auth] decoded role: <none>", { raw: role });
    }
    return null;
  } catch {
    return null;
  }
}

export function isAdminRole(role: JwtRole): boolean {
  return role !== null && (ADMIN_ROLES as ReadonlyArray<string>).includes(role);
}
