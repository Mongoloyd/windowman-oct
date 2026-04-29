/**
 * LandingPage.tsx — White-label /lp/:slug route.
 *
 * Validates the slug against the `clients` table, then renders the
 * identical homepage funnel. The slug is threaded into ScanFunnelContext
 * so lead creation and CAPI calls stamp the correct client_slug.
 *
 * If the slug is invalid or inactive → silent redirect to /.
 */

import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import Index from "./Index";
import { useScanFunnel } from "@/state/scanFunnel";

type SlugState = "loading" | "valid" | "invalid";

const LandingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<SlugState>("loading");
  const funnel = useScanFunnel();

  useEffect(() => {
    if (!slug) {
      setState("invalid");
      return;
    }

    let cancelled = false;

    supabase
      .from("clients")
      .select("id, name")
      .eq("slug", slug)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setState("invalid");
        } else {
          setState("valid");
        }
      });

    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (state !== "valid" || !slug || funnel.clientSlug === slug) return;
    funnel.setClientSlug(slug);
  }, [state, slug, funnel]);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (state === "invalid") {
    return <Navigate to="/" replace />;
  }

  if (funnel.clientSlug !== slug) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Index />
    </>
  );
};

export default LandingPage;
