/**
 * DEV-only Inheritance Inspector tab.
 *
 * Pure browser-safe analyzer over SCENARIO_FIXTURES. No network, no Supabase,
 * no edge functions. Uses src/test/fixtureInheritance.ts.
 */

import { useMemo, useState } from "react";
import {
  buildAllInheritanceReports,
  type InheritanceReport,
} from "@/test/fixtureInheritance";

const SANS = "'DM Sans', system-ui, -apple-system, sans-serif";
const MONO = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const C = {
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  border: "#1f2a3d",
  divider: "#16213a",
  panel: "#0f1729",
  panelAlt: "#0a0f1a",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: C.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "12px 0 6px",
  fontFamily: SANS,
};

const chip = (color: string): React.CSSProperties => ({
  display: "inline-block",
  background: `${color}26`,
  color,
  padding: "3px 8px",
  borderRadius: 4,
  fontSize: 13,
  margin: "2px 4px 2px 0",
  fontFamily: MONO,
  fontWeight: 500,
});

function FieldList({
  fields,
  color,
  empty = "—",
}: {
  fields: string[];
  color: string;
  empty?: string;
}) {
  if (!fields.length)
    return <span style={{ color: C.textMuted, fontSize: 13, fontFamily: SANS }}>{empty}</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap" }}>
      {fields.map((f) => (
        <span key={f} style={chip(color)}>
          {f}
        </span>
      ))}
    </div>
  );
}

function ScenarioDetail({ report }: { report: InheritanceReport }) {
  return (
    <div style={{ padding: "14px 16px", background: C.panelAlt, borderTop: `1px solid ${C.divider}` }}>
      <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8, fontFamily: SANS, lineHeight: 1.6 }}>
        expected grade:{" "}
        <b style={{ color: C.textPrimary, fontFamily: MONO }}>{report.expectedGrade ?? "—"}</b>{" "}
        · overridden:{" "}
        <b style={{ color: "#4ade80", fontFamily: MONO }}>{report.overridden.length}</b>{" "}
        · inherited:{" "}
        <b style={{ color: C.textSecondary, fontFamily: MONO }}>{report.inherited.length}</b>{" "}
        · risky inherited:{" "}
        <b style={{ color: report.riskyInherited.length ? "#fb923c" : C.textMuted, fontFamily: MONO }}>
          {report.riskyInherited.length}
        </b>
      </div>

      <div style={sectionTitle}>Risky inherited (top-level)</div>
      <FieldList fields={report.riskyInherited} color="#fb923c" empty="none" />

      <div style={sectionTitle}>Overridden (top-level)</div>
      <FieldList fields={report.overridden} color="#4ade80" />

      <div style={sectionTitle}>Inherited (top-level)</div>
      <FieldList fields={report.inherited} color="#94A3B8" />

      {report.lineItemReports.length > 0 && (
        <>
          <div style={sectionTitle}>Line items</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {report.lineItemReports.map((li) => (
              <div
                key={li.index}
                style={{
                  border: `1px solid ${C.divider}`,
                  borderRadius: 6,
                  padding: 10,
                  background: C.panel,
                }}
              >
                <div style={{ fontSize: 14, color: C.textPrimary, marginBottom: 4, fontFamily: SANS }}>
                  <b style={{ fontFamily: MONO }}>#{li.index}</b>{" "}
                  <span style={{ color: C.textSecondary }}>{li.description}</span>
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4, fontFamily: SANS }}>
                  risky inherited:
                </div>
                <FieldList fields={li.riskyInherited} color="#fb923c" empty="none" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function InheritanceInspectorTab() {
  const reports = useMemo(() => buildAllInheritanceReports(), []);
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div>
      <p style={{ fontSize: 13, color: C.textSecondary, margin: "0 0 12px", lineHeight: 1.55, fontFamily: SANS }}>
        Inherited fields matter because scenarios are built by starting from a perfect base
        quote and overriding only selected fields. If a risky scenario accidentally inherits
        too many strong fields, its grade may look too generous.
      </p>

      <div style={{ display: "flex", gap: 18, fontSize: 14, color: C.textSecondary, marginBottom: 12, fontFamily: SANS }}>
        <span>
          scenarios: <b style={{ color: C.textPrimary, fontFamily: MONO }}>{reports.length}</b>
        </span>
        <span>
          with risky inheritance:{" "}
          <b style={{ color: "#fb923c", fontFamily: MONO }}>
            {reports.filter((r) => r.riskyInherited.length > 0).length}
          </b>
        </span>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        {reports.map((r) => {
          const open = openKey === r.key;
          return (
            <div key={r.key}>
              <button
                onClick={() => setOpenKey(open ? null : r.key)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: open ? "rgba(255,255,255,0.04)" : "transparent",
                  color: C.textPrimary,
                  border: "none",
                  borderBottom: `1px solid ${C.divider}`,
                  padding: "12px 14px",
                  fontFamily: SANS,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 14,
                }}
              >
                <span>
                  <span style={{ color: C.textMuted, marginRight: 8 }}>{open ? "▾" : "▸"}</span>
                  <b style={{ fontFamily: MONO }}>{r.key}</b>
                  <span style={{ color: C.textSecondary, marginLeft: 10 }}>{r.label}</span>
                </span>
                <span style={{ fontSize: 13, color: C.textSecondary, fontFamily: SANS }}>
                  exp <b style={{ color: C.textPrimary, fontFamily: MONO }}>{r.expectedGrade ?? "—"}</b>
                  {"  ·  "}
                  risky{" "}
                  <b style={{ color: r.riskyInherited.length ? "#fb923c" : C.textMuted, fontFamily: MONO }}>
                    {r.riskyInherited.length}
                  </b>
                </span>
              </button>
              {open && <ScenarioDetail report={r} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default InheritanceInspectorTab;
