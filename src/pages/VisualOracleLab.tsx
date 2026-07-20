/**
 * Visual lab shell for fixture-only Window Oracle.
 * Route: /visual/oracle-lab (not DEV-gated; unlisted from production nav).
 *
 * SYNTHETIC DEVELOPMENT DATA — NOT LIVE MARKET DATA.
 * No Supabase, no tracking, no admin auth, no homeowner funnel.
 */

import { useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  OracleDashboardSurface,
  OracleDataLabSurface,
} from "@/components/admin/oracle";

type LabView = "data-lab" | "cockpit";

export default function VisualOracleLab() {
  const [view, setView] = useState<LabView>("cockpit");

  return (
    <>
      <Helmet>
        <title>Visual Lab · Window Oracle</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div
        role="status"
        className="fixed top-0 inset-x-0 z-50 h-7 flex items-center justify-center text-[11px] font-mono uppercase tracking-wider text-amber-200 border-b border-amber-500/30 backdrop-blur bg-[#3068e8]/[0.21]"
      >
        VISUAL LAB · SYNTHETIC DATA · NOT LIVE MARKET
      </div>
      <div className="pt-7 min-h-screen bg-slate-50">
        <div className="sticky top-7 z-40 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 mr-2">
            Window Oracle Lab
          </span>
          <button
            type="button"
            onClick={() => setView("cockpit")}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              view === "cockpit"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Operator Cockpit
          </button>
          <button
            type="button"
            onClick={() => setView("data-lab")}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              view === "data-lab"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            Data Lab
          </button>
        </div>
        {view === "cockpit" ? (
          <OracleDashboardSurface />
        ) : (
          <OracleDataLabSurface />
        )}
      </div>
    </>
  );
}
