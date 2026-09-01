/**
 * Visual lab shell for fixture-only Window Oracle.
 * Route: /visual/oracle-lab (not DEV-gated; unlisted from production nav).
 *
 * SYNTHETIC DEVELOPMENT DATA — NOT LIVE MARKET DATA.
 * No Supabase, no tracking, no admin auth, no homeowner funnel.
 */

import { useRef, useState } from "react";
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
import { OracleStatusRail, ORACLE_VISUAL_TOKENS } from "@/features/intelligence/components/OracleVisualSystem";

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
  const tabRefs = useRef<Partial<Record<LabView, HTMLButtonElement | null>>>({});

  const moveTabFocus = (current: LabView, key: string) => {
    const currentIndex = LAB_TABS.findIndex((tab) => tab.id === current);
    const nextIndex = key === "Home"
      ? 0
      : key === "End"
        ? LAB_TABS.length - 1
        : (currentIndex + (key === "ArrowRight" ? 1 : -1) + LAB_TABS.length) % LAB_TABS.length;
    const next = LAB_TABS[nextIndex];
    setView(next.id);
    requestAnimationFrame(() => tabRefs.current[next.id]?.focus());
  };

  return (
    <>
      <Helmet>
        <title>Visual Lab · Window Oracle</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <OracleStatusRail
        compact
        tone="synthetic"
        title="Visual Lab · Synthetic Data · Not Live Market"
        className="fixed inset-x-0 top-0 z-50 h-7 rounded-none border-x-0 border-t-0 backdrop-blur"
      />
      <div className="pt-7 min-h-screen bg-slate-50">
        <div role="tablist" aria-label="Oracle Lab surfaces" className="sticky top-7 z-40 flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="mr-2 shrink-0 text-xs font-semibold text-slate-700">
            Window Oracle Lab
          </span>
          {LAB_TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(node) => { tabRefs.current[tab.id] = node; }}
              id={`oracle-lab-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              aria-controls={`oracle-lab-panel-${tab.id}`}
              tabIndex={view === tab.id ? 0 : -1}
              onClick={() => setView(tab.id)}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  moveTabFocus(tab.id, event.key);
                }
              }}
              className={`min-h-11 shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-[background-color,border-color,box-shadow,transform] ${ORACLE_VISUAL_TOKENS.focusRing} ${
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
          <OracleStatusRail
            compact
            tone="legacy"
            title="Legacy Synthetic Engine · Dictionary-Guarded · DomainMetric Adapter Pass Pending"
            className="rounded-none border-x-0 border-t-0"
          />
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
