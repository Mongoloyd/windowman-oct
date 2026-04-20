/**
 * usePartnerAuth — Resolves partner identity state for route guarding.
 *
 * States:
 * - loading: checking auth + contractor profile
 * - unauthenticated: no session
 * - unlinked: authenticated but no contractor_profiles row (id = auth.uid())
 * - suspended: linked but contractor_profiles.status !== 'active'
 *               (includes 'pending_review' for self-serve registrations —
 *                PartnerGuard differentiates the copy via the `status` field)
 * - active: fully linked and active partner
 *
 * KEY: Uses `contractor_profiles` (RLS: auth.uid() = id) instead of
 * `contractors` (RLS: is_internal_operator()) so partner users can
 * actually read their own record.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PartnerState = "loading" | "unauthenticated" | "unlinked" | "suspended" | "active";

interface PartnerAuth {
  state: PartnerState;
  userId: string | null;
  contractorId: string | null;
  companyName: string | null;
  status: string | null;
}

export function usePartnerAuth(): PartnerAuth {
  const [auth, setAuth] = useState<PartnerAuth>({
    state: "loading",
    userId: null,
    contractorId: null,
    companyName: null,
    status: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!cancelled) setAuth({ state: "unauthenticated", userId: null, contractorId: null, companyName: null, status: null });
        return;
      }

      const userId = session.user.id;

      // contractor_profiles.id === auth.uid() — RLS allows this SELECT
      const { data: profile } = await supabase
        .from("contractor_profiles")
        .select("id, company_name, status")
        .eq("id", userId)
        .maybeSingle();

      if (!profile) {
        if (!cancelled) setAuth({ state: "unlinked", userId, contractorId: null, companyName: null, status: null });
        return;
      }

      if (profile.status !== "active") {
        if (!cancelled) setAuth({
          state: "suspended",
          userId,
          contractorId: profile.id,
          companyName: profile.company_name,
          status: profile.status,
        });
        return;
      }

      if (!cancelled) setAuth({
        state: "active",
        userId,
        contractorId: profile.id,
        companyName: profile.company_name,
        status: profile.status,
      });
    }

    resolve();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      resolve();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return auth;
}
