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
import { Shield, CreditCard, Plus, Loader2, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PreviewModeBadge } from "@/components/PreviewModeBadge";
import {
  PartnerPortalProvider,
  usePartnerPortal,
} from "./PartnerPortalContext";
import { PartnerPortalNav } from "./PartnerPortalNav";

function PartnerLayoutInner() {
  const { creditBalance, isPreview, isDemoMode, toggleDemoMode } = usePartnerPortal();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [searchParams] = useSearchParams();

  // Note: payment=success / payment=cancel handling stays inside
  // ContractorOpportunitiesPage — that page owns the post-checkout
  // refetch which is the only thing that resolves the new balance.
  void searchParams;

  const handleAddCredits = async () => {
    if (isDemoMode) {
      toast("Demo Mode: checkout is disabled.");
      return;
    }

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
  const demoControlsArmed = isDemoMode || searchParams.get("demo") === "1" || searchParams.get("wm_demo") === "1";

  return (
    <div className="wm-dashboard-surface min-h-screen bg-white text-slate-950 font-sans">
      {isDemoMode && (
        <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-black uppercase tracking-wider text-amber-950">
          Demo Mode: Viewing Sample Data
        </div>
      )}

      {/* ─── Sticky Portal Header ─────────────────────────────── */}
      <header className={`${isDemoMode ? "top-[37px]" : "top-0"} border-b border-slate-300 bg-white sticky z-30 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/95`}>
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
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-none text-slate-950 group-hover:text-primary transition-colors">
                    WindowMan Partner Portal
                  </h1>
                  {isPreview && <PreviewModeBadge />}
                </div>
                <p className="text-sm font-bold text-slate-700 mt-1">
                  Contractor Intelligence Workspace
                </p>
              </div>
            </Link>

            {/* Credits + CTA */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap justify-end">
              {demoControlsArmed && (
                <button
                  type="button"
                  onClick={toggleDemoMode}
                  aria-pressed={isDemoMode}
                  className={`flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-extrabold shadow-sm transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 whitespace-nowrap ${
                    isDemoMode
                      ? "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200"
                      : "border-slate-400 bg-white text-slate-950 hover:bg-slate-50"
                  }`}
                >
                  <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                  Demo {isDemoMode ? "On" : "Off"}
                </button>
              )}
              <div
                className="flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-md border border-slate-400 bg-white shadow-sm flex-1 sm:flex-initial justify-center"
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
                className={`flex min-h-10 items-center gap-1.5 px-4 py-2 rounded-md border text-sm font-extrabold shadow-sm active:scale-[0.99] transition-all disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2 whitespace-nowrap ${
                  isDemoMode
                    ? "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-100"
                    : "border-blue-900 bg-blue-900 text-white hover:bg-blue-800"
                }`}
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

      <footer className="text-center text-sm font-bold text-slate-700 py-8">
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
