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

const sectionTitle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#999",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "8px 0 4px",
};

const chip = (color: string): React.CSSProperties => ({
  display: "inline-block",
  background: `${color}22`,
  color,
  padding: "1px 5px",
  borderRadius: 3,
  fontSize: 10,
  margin: "1px 3px 1px 0",
  fontFamily: "'DM Mono', monospace",
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
  if (!fields.length) return <span style={{ color: "#555", fontSize: 10 }}>{empty}</span>;
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
    <div style={{ padding: "8px 10px", background: "#0f0f0f", borderTop: "1px solid #1a1a1a" }}>
      <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>
        expected grade:{" "}
        <b style={{ color: "#e5e5e5" }}>{report.expectedGrade ?? "—"}</b>{" "}
        · overridden: <b style={{ color: "#22c55e" }}>{report.overridden.length}</b>{" "}
        · inherited: <b style={{ color: "#94a3b8" }}>{report.inherited.length}</b>{" "}
        · risky inherited:{" "}
        <b style={{ color: report.riskyInherited.length ? "#f97316" : "#555" }}>
          {report.riskyInherited.length}
        </b>
      </div>

      <div style={sectionTitle}>Risky inherited (top-level)</div>
      <FieldList fields={report.riskyInherited} color="#f97316" empty="none" />

      <div style={sectionTitle}>Overridden (top-level)</div>
      <FieldList fields={report.overridden} color="#22c55e" />

      <div style={sectionTitle}>Inherited (top-level)</div>
      <FieldList fields={report.inherited} color="#64748b" />

      {report.lineItemReports.length > 0 && (
        <>
          <div style={sectionTitle}>Line items</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {report.lineItemReports.map((li) => (
              <div
                key={li.index}
                style={{
                  border: "1px solid #1a1a1a",
                  borderRadius: 4,
                  padding: 6,
                  background: "#0a0a0a",
                }}
              >
                <div style={{ fontSize: 11, color: "#e5e5e5", marginBottom: 3 }}>
                  <b>#{li.index}</b>{" "}
                  <span style={{ color: "#888" }}>{li.description}</span>
                </div>
                <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>
                  risky inherited:
                </div>
                <FieldList
                  fields={li.riskyInherited}
                  color="#f97316"
                  empty="none"
                />
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
      <p style={{ fontSize: 10, color: "#888", margin: "0 0 8px", lineHeight: 1.4 }}>
        Inherited fields matter because scenarios are built by starting from a perfect base
        quote and overriding only selected fields. If a risky scenario accidentally inherits
        too many strong fields, its grade may look too generous.
      </p>

      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#999", marginBottom: 8 }}>
        <span>
          scenarios: <b style={{ color: "#e5e5e5" }}>{reports.length}</b>
        </span>
        <span>
          with risky inheritance:{" "}
          <b style={{ color: "#f97316" }}>
            {reports.filter((r) => r.riskyInherited.length > 0).length}
          </b>
        </span>
      </div>

      <div style={{ border: "1px solid #1a1a1a", borderRadius: 4 }}>
        {reports.map((r) => {
          const open = openKey === r.key;
          return (
            <div key={r.key}>
              <button
                onClick={() => setOpenKey(open ? null : r.key)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: open ? "#181818" : "transparent",
                  color: "#e5e5e5",
                  border: "none",
                  borderBottom: "1px solid #1a1a1a",
                  padding: "8px 10px",
                  fontFamily: "'DM Mono', monospace",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                }}
              >
                <span>
                  <span style={{ color: "#888", marginRight: 6 }}>{open ? "▾" : "▸"}</span>
                  <b>{r.key}</b>
                  <span style={{ color: "#666", marginLeft: 8 }}>{r.label}</span>
                </span>
                <span style={{ fontSize: 10, color: "#666" }}>
                  exp <b style={{ color: "#e5e5e5" }}>{r.expectedGrade ?? "—"}</b>
                  {" · "}
                  risky{" "}
                  <b style={{ color: r.riskyInherited.length ? "#f97316" : "#555" }}>
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
