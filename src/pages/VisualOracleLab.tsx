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
import { InternalIntelligenceConsole } from "@/features/intelligence-console/InternalIntelligenceConsole";
import {
  INTERNAL_INTELLIGENCE_FIXTURE,
  IntelligenceConsoleSurface,
  PUBLIC_ORACLE_VIEW_MODEL,
  PublicOracleSurface,
} from "@/features/intelligence";

type LabView = "public-oracle" | "observatory-console" | "foundation-console" | "data-lab" | "cockpit";

const LAB_TABS: ReadonlyArray<{ id: LabView; label: string }> = [
  { id: "public-oracle", label: "Public Oracle" },
  { id: "observatory-console", label: "Observatory Console" },
  { id: "foundation-console", label: "Foundation Console" },
  { id: "cockpit", label: "Operator Cockpit" },
  { id: "data-lab", label: "Data Lab" },
];

export default function VisualOracleLab() {
  const [view, setView] = useState<LabView>("public-oracle");

  return (
    <>
      <Helmet>
        <title>Visual Lab · Window Oracle</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-50 flex h-7 items-center justify-center border-b border-amber-300 bg-amber-50 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-950 backdrop-blur"
      >
        VISUAL LAB · SYNTHETIC DATA · NOT LIVE MARKET
      </div>
      <div className="pt-7 min-h-screen bg-slate-50">
        <div role="tablist" aria-label="Oracle Lab surfaces" className="sticky top-7 z-40 flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="mr-2 shrink-0 text-xs font-semibold text-slate-700">
            Window Oracle Lab
          </span>
          {LAB_TABS.map((tab) => (
            <button
              key={tab.id}
              id={`oracle-lab-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              aria-controls={`oracle-lab-panel-${tab.id}`}
              onClick={() => setView(tab.id)}
              className={`min-h-11 shrink-0 rounded-lg border px-3 py-2 text-xs font-medium ${
                view === tab.id
                  ? "border-blue-800 bg-[#0B1830] text-white shadow-[0_4px_12px_rgba(11,24,48,0.18)]"
                  : "border-slate-200 bg-white text-slate-700 shadow-sm"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {view !== "public-oracle" ? (
          <div role="status" className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-center text-[11px] font-bold text-blue-950">
            LEGACY SYNTHETIC ENGINE · DICTIONARY-GUARDED · DOMAINMETRIC ADAPTER PASS PENDING
          </div>
        ) : null}
        <section
          id={`oracle-lab-panel-${view}`}
          role="tabpanel"
          aria-labelledby={`oracle-lab-tab-${view}`}
        >
          {view === "public-oracle" ? <PublicOracleSurface viewModel={PUBLIC_ORACLE_VIEW_MODEL} /> : null}
          {view === "observatory-console" ? <IntelligenceConsoleSurface data={INTERNAL_INTELLIGENCE_FIXTURE} /> : null}
          {view === "foundation-console" ? <InternalIntelligenceConsole /> : null}
          {view === "cockpit" ? <OracleDashboardSurface /> : null}
          {view === "data-lab" ? <OracleDataLabSurface /> : null}
        </section>
      </div>
    </>
  );
}
