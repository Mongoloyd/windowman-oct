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

function StatusChip({ status }: { status: Status }) {
  const map: Record<Status, { bg: string; fg: string; label: string }> = {
    PASS: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e", label: "PASS" },
    FAIL: { bg: "rgba(239,68,68,0.15)", fg: "#ef4444", label: "FAIL" },
    SKIP: { bg: "rgba(148,163,184,0.15)", fg: "#94a3b8", label: "SKIP" },
  };
  const s = map[status];
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        padding: "2px 6px",
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
      }}
    >
      {s.label}
    </span>
  );
}

function GradeCell({ g }: { g: string | null | undefined }) {
  if (!g || g === "—") return <span style={{ color: "#444" }}>—</span>;
  const color = GRADE_COLORS[g] ?? "#94a3b8";
  return <span style={{ color, fontWeight: 700 }}>{g}</span>;
}

type TabKey = "local" | "inheritance";

export function ScannerLab() {
  const [tab, setTab] = useState<TabKey>("local");
  const rows = useMemo(() => runFixtures(), []);

  const total = rows.length;
  const pass = rows.filter((r) => r.status === "PASS").length;
  const fail = rows.filter((r) => r.status === "FAIL").length;
  const skip = rows.filter((r) => r.status === "SKIP").length;

  return (
    <div
      style={{
        background: "#0a0a0a",
        border: "1px dashed #555",
        borderRadius: 8,
        padding: 14,
        width: 760,
        maxHeight: "70vh",
        overflowY: "auto",
        fontFamily: "'DM Mono', monospace",
        color: "#e5e5e5",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e5e5e5", fontFamily: "'DM Sans', sans-serif" }}>
          🧪 Scanner Lab
        </h3>
        <span style={{ fontSize: 10, color: "#666" }}>DEV · local only · no network</span>
      </div>

      {/* Tab strip */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, borderBottom: "1px solid #222" }}>
        <TabButton
          active={tab === "local"}
          label="Local Fixture Brain"
          onClick={() => setTab("local")}
        />
        <TabButton
          active={tab === "inheritance"}
          label="Inheritance"
          onClick={() => setTab("inheritance")}
        />
        <TabButton disabled label="Backend Runner" />
        <TabButton disabled label="Rubric Intelligence" />
      </div>

      {tab === "local" && (
        <>
          {/* Summary */}
          <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#999", marginBottom: 8 }}>
            <span>total: <b style={{ color: "#e5e5e5" }}>{total}</b></span>
            <span>pass: <b style={{ color: "#22c55e" }}>{pass}</b></span>
            <span>fail: <b style={{ color: "#ef4444" }}>{fail}</b></span>
            <span>skip: <b style={{ color: "#94a3b8" }}>{skip}</b></span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #333", color: "#999" }}>
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
                  <tr key={r.key} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={td}><StatusChip status={r.status} /></td>
                    <td style={{ ...td, color: "#e5e5e5" }}>
                      <div style={{ fontWeight: 600 }}>{r.key}</div>
                      <div style={{ color: "#666", fontSize: 10 }}>{r.label}</div>
                      {r.expectedTerminal && (
                        <div style={{ color: "#94a3b8", fontSize: 9 }}>terminal: {r.expectedTerminal}</div>
                      )}
                    </td>
                    <td style={td}><GradeCell g={r.expected ?? null} /></td>
                    <td style={td}><GradeCell g={r.actual} /></td>
                    <td style={{ ...td, color: "#999" }}>{r.weighted ?? "—"}</td>
                    <td style={{ ...td, color: r.hardCap ? "#f97316" : "#444", fontSize: 10 }}>{r.hardCap ?? "—"}</td>
                    <td style={{ ...td, color: "#999" }}>{r.pillars.safety ?? "—"}</td>
                    <td style={{ ...td, color: "#999" }}>{r.pillars.install ?? "—"}</td>
                    <td style={{ ...td, color: "#999" }}>{r.pillars.price ?? "—"}</td>
                    <td style={{ ...td, color: "#999" }}>{r.pillars.finePrint ?? "—"}</td>
                    <td style={{ ...td, color: "#999" }}>{r.pillars.warranty ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 10, fontSize: 10, color: "#555" }}>
            Pure local: SCENARIO_FIXTURES → computeGrade(). No Supabase, no edge functions, no network.
          </p>
        </>
      )}

      {tab === "inheritance" && <InheritanceInspectorTab />}
    </div>
  );
}

function TabButton({
  label,
  active,
  disabled,
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
        background: "transparent",
        color: active ? "#C8952A" : disabled ? "#444" : "#888",
        border: "none",
        borderBottom: active ? "2px solid #C8952A" : "2px solid transparent",
        padding: "6px 10px",
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'DM Sans', sans-serif",
      }}
      title={disabled ? "Coming in next phase" : undefined}
    >
      {label}
    </button>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "6px 6px", fontWeight: 600, fontSize: 10 };
const td: React.CSSProperties = { padding: "6px 6px", verticalAlign: "top" };

export default ScannerLab;
