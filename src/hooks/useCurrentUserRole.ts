/**
 * ═══════════════════════════════════════════════════════════════════════════
 * useCurrentUserRole — Hook to fetch and cache the current user's RBAC role
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Queries the user_roles table for the authenticated user's role.
 * * FIX: Uses .eq("id", ...) to match your actual DB schema.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/services/adminDataService";

interface UseCurrentUserRoleResult {
  role: AppRole | null;
  userId: string | null;
  email: string | null;
  isLoading: boolean;
  error: string | null;

  /** Convenience booleans for UI logic */
  isSuperAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
  hasWriteAccess: boolean;
  hasAnyRole: boolean;

  /** Force re-fetch the role */
  refetch: () => Promise<void>;
}

export function useCurrentUserRole(): UseCurrentUserRoleResult {
  // ── DEV BYPASS: mock super_admin in Lovable sandbox ──────────────
  if (import.meta.env.DEV) {
    return {
      role: "super_admin",
      userId: "dev-sandbox-user",
      email: "dev@windowman.app",
      isLoading: false,
      error: null,
      isSuperAdmin: true,
      isOperator: false,
      isViewer: false,
      hasWriteAccess: true,
      hasAnyRole: true,
      refetch: async () => {},
    };
  }

  const [role, setRole] = useState<AppRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRole = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setRole(null);
        setUserId(null);
        setEmail(null);
        return;
      }

      setUserId(session.user.id);
      setEmail(session.user.email || null);

      // CRITICAL FIX: We use "id" here because that is your DB column name
      const { data, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("id", session.user.id) 
        .maybeSingle();

      if (roleError) {
        console.error("[useCurrentUserRole] Error:", roleError.message);
        setError("Failed to fetch role");
        setRole(null);
        return;
      }

      if (!data) {
        setRole(null);
        return;
      }

      const validRoles: AppRole[] = ["super_admin", "operator", "viewer"];
      const fetchedRole = data.role as string;

      if (validRoles.includes(fetchedRole as AppRole)) {
        setRole(fetchedRole as AppRole);
      } else if (fetchedRole === "admin") {
        // Handle the legacy role just in case
        setRole("super_admin");
      } else {
        setRole(null);
        setError(`Unknown role: ${fetchedRole}`);
      }
    } catch (err) {
      console.error("[useCurrentUserRole] Unexpected error:", err);
      setError("Failed to determine user role");
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchRole();
      } else {
        setRole(null);
        setUserId(null);
        setEmail(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  return {
    role,
    userId,
    email,
    isLoading,
    error,
    isSuperAdmin: role === "super_admin",
    isOperator: role === "operator",
    isViewer: role === "viewer",
    hasWriteAccess: role === "super_admin" || role === "operator",
    hasAnyRole: role !== null,
    refetch: fetchRole,
  };
}
