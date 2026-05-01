/**
 * DEV-only Scanner Lab tab: Rubric Intelligence.
 *
 * Renders an explainer card above the existing RubricComparison dashboard.
 * No new props, no new providers, no Supabase queries here — RubricComparison
 * owns its own data flow via useRubricStats / get_rubric_stats RPC.
 */

import { RubricComparison } from "../../RubricComparison";

export function RubricIntelligenceTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          background: "#0f0f0f",
          border: "1px solid #2a2a2a",
          borderRadius: 6,
          padding: 12,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <h4
          style={{
            margin: 0,
            marginBottom: 6,
            fontSize: 12,
            fontWeight: 700,
            color: "#C8952A",
            letterSpacing: "0.02em",
          }}
        >
          Live Runs / Operator-Gated Rubric Intelligence
        </h4>
        <p style={{ margin: 0, fontSize: 11, color: "#999", lineHeight: 1.5 }}>
          This tab reads live analysis statistics through the{" "}
          <code style={{ color: "#e5e5e5" }}>get_rubric_stats</code> RPC. It can be
          empty in Lovable preview because it requires an internal operator session
          and completed <code style={{ color: "#e5e5e5" }}>analyses</code> rows.
          Local fixture diagnostics do not write to{" "}
          <code style={{ color: "#e5e5e5" }}>analyses</code>; use the Local Fixture
          Brain tab for zero-network scoring.
        </p>
      </div>

      <RubricComparison />
    </div>
  );
}

export default RubricIntelligenceTab;
