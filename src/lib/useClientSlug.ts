/**
 * useClientSlug — Resolve and validate a `?client=<slug>` query param.
 *
 * WHY THIS EXISTS
 * ---------------
 * The canonical white-label entry is `/lp/:slug`, validated by `LandingPage.tsx`.
 * In practice, paid traffic frequently lands on `/` with attribution params like
 * `/?client=acme&utm_source=meta&...` instead of `/lp/acme`. Without this hook,
 * `leads.client_slug` would be NULL for that traffic even though the lead clearly
 * belongs to a partner client.
 *
 * Behavior:
 *   1. Read `?client=<slug>` from `window.location.search` (one-shot, no listener).
 *   2. Validate the slug against `public.clients` (must exist + `is_active=true`).
 *   3. Return the validated slug, or `null` if absent/invalid.
 *
 * Returns `{ slug: string | null, ready: boolean }`.
 *   - `ready=false` while the validation query is in flight.
 *   - `ready=true` with `slug=null` means "no client / not validated" (default traffic).
 *
 * Non-goals:
 *   - Does not change OTP, reveal, Twilio, or browser pixel behavior.
 *   - Does not write anywhere — pure read + validate.
 *   - Does not react to URL changes after mount (entry-time only, like UTM capture).
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseClientSlugResult {
  slug: string | null;
  ready: boolean;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

export function useClientSlug(): UseClientSlugResult {
  const [slug, setSlug] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setReady(true);
      return;
    }

    const raw = new URLSearchParams(window.location.search).get("client");
    const candidate = raw?.trim().toLowerCase() ?? "";

    if (!candidate || !SLUG_RE.test(candidate)) {
      setReady(true);
      return;
    }

    let cancelled = false;
    supabase
      .from("clients")
      .select("slug")
      .eq("slug", candidate)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (cancelled) return;
          if (!error && data?.slug) {
            setSlug(data.slug);
          }
          setReady(true);
        },
        () => {
          if (cancelled) return;
          setSlug(null);
          setReady(true);
        },
      );

    return () => { cancelled = true; };
  }, []);

  return { slug, ready };
}
