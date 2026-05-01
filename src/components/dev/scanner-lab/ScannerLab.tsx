/**
 * DEV-only Scanner Lab cockpit. Tree-shaken from production via
 * `import.meta.env.DEV` gate at the import site (DevPreviewPanel.tsx).
 *
 * Phase 1: Local Fixture Brain only. No network, no Supabase, no edge
 * functions. Pure local computeGrade() over SCENARIO_FIXTURES.
 */

import { useMemo, useState } from "react";
import { SCENARIO_FIXTURES } from "@/test/createMockQuote";
import {
  computeGrade,
  type ExtractionResult,
} from "../../../../supabase/functions/scan-quote/scoring.ts";
import { InheritanceInspectorTab } from "./tabs/InheritanceInspectorTab";
import { BackendRunnerTab } from "./tabs/BackendRunnerTab";
import { RubricIntelligenceTab } from "./tabs/RubricIntelligenceTab";

type Status = "PASS" | "FAIL" | "SKIP";

interface Row {
  key: string;
  label: string;
  expected: string | null | undefined;
  expectedTerminal: string | undefined;
  actual: string;
  weighted: number | null;
  hardCap: string | null;
  pillars: {
    safety: number | null;
    install: number | null;
    price: number | null;
    finePrint: number | null;
    warranty: number | null;
  };
  status: Status;
}

function runFixtures(): Row[] {
  const out: Row[] = [];
  for (const fx of SCENARIO_FIXTURES as any[]) {
    const key = fx.key ?? "(unknown)";
    const label = fx.label ?? "";
    const expected = fx.expectedGrade as string | null | undefined;
    const expectedTerminal = fx.expectedTerminal as string | undefined;
    const extraction = fx.extraction as ExtractionResult | undefined;

    if (!extraction || expectedTerminal) {
      out.push({
        key,
        label,
        expected,
        expectedTerminal,
        actual: "—",
        weighted: null,
        hardCap: null,
        pillars: { safety: null, install: null, price: null, finePrint: null, warranty: null },
        status: "SKIP",
      });
      continue;
    }

    const result = computeGrade(extraction) as any;
    const actual = result.letterGrade ?? result.grade ?? "?";
    const weightedRaw = result.weightedAverage ?? result.weighted ?? null;
    const hardCapRaw = result.hardCapApplied ?? null;
    const hardCap = Array.isArray(hardCapRaw) ? hardCapRaw.join(",") : hardCapRaw;
    const p = result.pillars ?? result.pillarScores ?? {};

    out.push({
      key,
      label,
      expected,
      expectedTerminal,
      actual,
      weighted: typeof weightedRaw === "number" ? Number(weightedRaw.toFixed(2)) : weightedRaw,
      hardCap,
      pillars: {
        safety: p.safety?.score ?? p.safety ?? null,
        install: p.install?.score ?? p.install ?? null,
        price: p.price?.score ?? p.price ?? null,
        finePrint: p.finePrint?.score ?? p.fine_print?.score ?? p.finePrint ?? null,
        warranty: p.warranty?.score ?? p.warranty ?? null,
      },
      status: expected && actual === expected ? "PASS" : "FAIL",
    });
  }
  return out;
}

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#84cc16",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

const SANS = "'DM Sans', system-ui, -apple-system, sans-serif";
const MONO = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const COLOR = {
  bg: "#0a0f1a",
  panel: "#0F1F35",
  border: "#1f2a3d",
  divider: "#16213a",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  accent: "#C8952A",
};

function StatusChip({ status }: { status: Status }) {
  const map: Record<Status, { bg: string; fg: string; label: string }> = {
    PASS: { bg: "rgba(34,197,94,0.18)", fg: "#4ade80", label: "PASS" },
    FAIL: { bg: "rgba(239,68,68,0.18)", fg: "#f87171", label: "FAIL" },
    SKIP: { bg: "rgba(148,163,184,0.18)", fg: "#cbd5e1", label: "SKIP" },
  };
  const s = map[status];
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.06em",
        fontFamily: SANS,
      }}
    >
      {s.label}
    </span>
  );
}

function GradeCell({ g }: { g: string | null | undefined }) {
  if (!g || g === "—") return <span style={{ color: COLOR.textMuted }}>—</span>;
  const color = GRADE_COLORS[g] ?? COLOR.textSecondary;
  return <span style={{ color, fontWeight: 700, fontSize: 15 }}>{g}</span>;
}

type TabKey = "local" | "inheritance" | "backend" | "rubric";

interface ScannerLabProps {
  sessionId?: string | null;
  onScanStart?: (fileName: string, scanSessionId: string) => void;
}

export function ScannerLab({ sessionId, onScanStart }: ScannerLabProps = {}) {
  const [tab, setTab] = useState<TabKey>("local");
  const rows = useMemo(() => runFixtures(), []);

  const total = rows.length;
  const pass = rows.filter((r) => r.status === "PASS").length;
  const fail = rows.filter((r) => r.status === "FAIL").length;
  const skip = rows.filter((r) => r.status === "SKIP").length;

  return (
    <div
      style={{
        background: COLOR.bg,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 12,
        padding: 20,
        width: "min(1280px, 88vw)",
        maxHeight: "84vh",
        overflowY: "auto",
        fontFamily: SANS,
        color: COLOR.textPrimary,
        boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLOR.textPrimary, fontFamily: SANS, letterSpacing: "-0.01em" }}>
            🧪 Scanner Lab
          </h3>
          <span style={{ fontSize: 12, color: COLOR.textMuted, fontFamily: SANS }}>
            DEV cockpit
          </span>
        </div>
        <span style={{ fontSize: 13, color: COLOR.textMuted, fontFamily: MONO, letterSpacing: "0.03em" }}>
          local-first · no production exposure
        </span>
      </div>

      {/* Tab strip */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${COLOR.border}` }}>
        <TabButton active={tab === "local"} label="Local Fixture Brain" onClick={() => setTab("local")} />
        <TabButton active={tab === "inheritance"} label="Inheritance" onClick={() => setTab("inheritance")} />
        <TabButton active={tab === "backend"} label="Backend Runner" onClick={() => setTab("backend")} />
        <TabButton active={tab === "rubric"} label="Rubric Intelligence" onClick={() => setTab("rubric")} />
      </div>

      {tab === "local" && (
        <>
          {/* Summary */}
          <div style={{ display: "flex", gap: 18, fontSize: 14, color: COLOR.textSecondary, marginBottom: 14, fontFamily: SANS }}>
            <span>total: <b style={{ color: COLOR.textPrimary, fontFamily: MONO }}>{total}</b></span>
            <span>pass: <b style={{ color: "#4ade80", fontFamily: MONO }}>{pass}</b></span>
            <span>fail: <b style={{ color: "#f87171", fontFamily: MONO }}>{fail}</b></span>
            <span>skip: <b style={{ color: COLOR.textMuted, fontFamily: MONO }}>{skip}</b></span>
          </div>

          <div style={{ overflowX: "auto", border: `1px solid ${COLOR.divider}`, borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLOR.border}`, color: COLOR.textSecondary, background: "rgba(255,255,255,0.02)" }}>
                  <th style={th}>Status</th>
                  <th style={th}>Scenario</th>
                  <th style={th}>Exp</th>
                  <th style={th}>Act</th>
                  <th style={th}>Wtd</th>
                  <th style={th}>HardCap</th>
                  <th style={th}>S</th>
                  <th style={th}>I</th>
                  <th style={th}>P</th>
                  <th style={th}>FP</th>
                  <th style={th}>W</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} style={{ borderBottom: `1px solid ${COLOR.divider}` }}>
                    <td style={td}><StatusChip status={r.status} /></td>
                    <td style={{ ...td, color: COLOR.textPrimary }}>
                      <div style={{ fontWeight: 600, fontFamily: MONO, fontSize: 14 }}>{r.key}</div>
                      <div style={{ color: COLOR.textSecondary, fontSize: 13, fontFamily: SANS, marginTop: 2 }}>{r.label}</div>
                      {r.expectedTerminal && (
                        <div style={{ color: COLOR.textMuted, fontSize: 12, fontFamily: SANS, marginTop: 2 }}>
                          terminal: {r.expectedTerminal}
                        </div>
                      )}
                    </td>
                    <td style={td}><GradeCell g={r.expected ?? null} /></td>
                    <td style={td}><GradeCell g={r.actual} /></td>
                    <td style={tdMono}>{r.weighted ?? "—"}</td>
                    <td style={{ ...tdMono, color: r.hardCap ? "#fb923c" : COLOR.textMuted, fontSize: 13 }}>
                      {r.hardCap ?? "—"}
                    </td>
                    <td style={tdMono}>{r.pillars.safety ?? "—"}</td>
                    <td style={tdMono}>{r.pillars.install ?? "—"}</td>
                    <td style={tdMono}>{r.pillars.price ?? "—"}</td>
                    <td style={tdMono}>{r.pillars.finePrint ?? "—"}</td>
                    <td style={tdMono}>{r.pillars.warranty ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 14, fontSize: 13, color: COLOR.textMuted, fontFamily: SANS, lineHeight: 1.5 }}>
            Pure local: SCENARIO_FIXTURES → computeGrade(). No Supabase, no edge functions, no network.
          </p>
        </>
      )}

      {tab === "inheritance" && <InheritanceInspectorTab />}
      {tab === "backend" && <BackendRunnerTab sessionId={sessionId} onScanStart={onScanStart} />}
      {tab === "rubric" && <RubricIntelligenceTab />}
    </div>
  );
}

function TabButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        background: active ? "rgba(200,149,42,0.10)" : "transparent",
        color: active ? COLOR.accent : disabled ? "#3a4358" : COLOR.textSecondary,
        border: "none",
        borderBottom: active ? `2px solid ${COLOR.accent}` : "2px solid transparent",
        padding: "10px 16px",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: SANS,
        transition: "color 0.15s, background 0.15s",
        marginBottom: -1,
      }}
      title={disabled ? "Coming in next phase" : undefined}
    >
      {label}
    </button>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 10px",
  fontWeight: 600,
  fontSize: 13,
  fontFamily: SANS,
  letterSpacing: "0.02em",
};
const td: React.CSSProperties = {
  padding: "10px 10px",
  verticalAlign: "top",
  fontSize: 14,
  fontFamily: SANS,
};
const tdMono: React.CSSProperties = {
  padding: "10px 10px",
  verticalAlign: "top",
  fontSize: 14,
  fontFamily: MONO,
  color: COLOR.textSecondary,
};

export default ScannerLab;
