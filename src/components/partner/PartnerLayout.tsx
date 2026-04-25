/**
 * PartnerLayout — shared chrome for in-portal partner pages.
 *
 * Owns:
 *  - Sticky portal header (brand + identity)
 *  - Persistent primary nav (PartnerPortalNav)
 *  - Global credit balance pill
 *  - Global "Add Credits" CTA (calls the same `create-checkout-session`
 *    edge function previously called from ContractorOpportunitiesPage)
 *
 * Page content renders into <Outlet />. Nested pages publish their live
 * credit balance via PartnerPortalProvider so the header doesn't go stale
 * while navigating between Market and Dossier.
 */

import { useState } from "react";
import { Outlet, Link, useSearchParams } from "react-router-dom";
import { Shield, CreditCard, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PreviewModeBadge } from "@/components/PreviewModeBadge";
import {
  PartnerPortalProvider,
  usePartnerPortal,
} from "./PartnerPortalContext";
import { PartnerPortalNav } from "./PartnerPortalNav";

function PartnerLayoutInner() {
  const { creditBalance, isPreview } = usePartnerPortal();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [searchParams] = useSearchParams();

  // Note: payment=success / payment=cancel handling stays inside
  // ContractorOpportunitiesPage — that page owns the post-checkout
  // refetch which is the only thing that resolves the new balance.
  void searchParams;

  const handleAddCredits = async () => {
    setCheckoutLoading(true);
    try {
      const origin = window.location.origin;
      const res = await supabase.functions.invoke("create-checkout-session", {
        body: { pack_code: "pack_10_credits", origin },
      });

      if (res.error) {
        console.error("[AddCredits] invoke error:", res.error);
        toast.error("Failed to start checkout. Please try again.");
        setCheckoutLoading(false);
        return;
      }

      const data = res.data as { url?: string; error?: string; message?: string };
      if (!data?.url) {
        toast.error(data?.message ?? "Failed to create checkout session.");
        setCheckoutLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("[AddCredits] unhandled error:", err);
      toast.error("Something went wrong. Please try again.");
      setCheckoutLoading(false);
    }
  };

  const balanceDisplay = creditBalance ?? 0;

  return (
    <div className="wm-dashboard-surface min-h-screen bg-background text-foreground font-sans">
      {/* ─── Sticky Portal Header ─────────────────────────────── */}
      <header className="border-b border-slate-200 bg-card sticky top-0 z-30 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/95">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Brand */}
            <Link
              to="/partner/opportunities"
              className="flex items-center gap-3 min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <div className="h-9 w-9 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-sky-600" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black tracking-tight leading-none group-hover:text-primary transition-colors">
                    WindowMan Partner Portal
                  </h1>
                  {isPreview && <PreviewModeBadge />}
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-600 mt-1">
                  Contractor Intelligence Workspace
                </p>
              </div>
            </Link>

            {/* Credits + CTA */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <div
                className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white shadow-sm flex-1 sm:flex-initial justify-center"
                aria-label={`Credit balance: ${balanceDisplay}`}
              >
                <CreditCard className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                <span className="text-sm font-bold font-mono text-slate-950 whitespace-nowrap">
                  {balanceDisplay} credit{balanceDisplay !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddCredits}
                disabled={checkoutLoading}
                aria-label="Add credits"
                className="flex min-h-10 items-center gap-1.5 px-4 py-2 rounded-md border border-primary bg-primary text-primary-foreground text-sm font-extrabold shadow-sm hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 whitespace-nowrap"
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Connecting…
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Add Credits
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Primary nav */}
          <div className="mt-3 sm:mt-4">
            <PartnerPortalNav />
          </div>
        </div>
      </header>

      <Outlet />

      <footer className="text-center text-sm font-medium text-slate-600 py-8">
        WindowMan Partner Portal — Contractor Eyes Only
      </footer>
    </div>
  );
}

export function PartnerLayout() {
  return (
    <PartnerPortalProvider>
      <PartnerLayoutInner />
    </PartnerPortalProvider>
  );
}

export default PartnerLayout;
