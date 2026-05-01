/**
 * DEV-only Scanner Lab tab: Rubric Intelligence.
 *
 * Renders an explainer card above the existing RubricComparison dashboard.
 * No new props, no new providers, no Supabase queries here — RubricComparison
 * owns its own data flow via useRubricStats / get_rubric_stats RPC.
 */

import { RubricComparison } from "../../RubricComparison";

const SANS = "'DM Sans', system-ui, -apple-system, sans-serif";
const MONO = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export function RubricIntelligenceTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "rgba(200,149,42,0.06)",
          border: "1px solid rgba(200,149,42,0.30)",
          borderRadius: 8,
          padding: 16,
          fontFamily: SANS,
        }}
      >
        <h4
          style={{
            margin: 0,
            marginBottom: 8,
            fontSize: 15,
            fontWeight: 700,
            color: "#C8952A",
            letterSpacing: "0.02em",
          }}
        >
          Live Runs / Operator-Gated Rubric Intelligence
        </h4>
        <p style={{ margin: 0, fontSize: 13, color: "#CBD5E1", lineHeight: 1.6 }}>
          This tab reads live analysis statistics through the{" "}
          <code style={{ color: "#F8FAFC", fontFamily: MONO }}>get_rubric_stats</code> RPC. It can be
          empty in Lovable preview because it requires an internal operator session
          and completed <code style={{ color: "#F8FAFC", fontFamily: MONO }}>analyses</code> rows.
          Local fixture diagnostics do not write to{" "}
          <code style={{ color: "#F8FAFC", fontFamily: MONO }}>analyses</code>; use the Local Fixture
          Brain tab for zero-network scoring.
        </p>
      </div>

      <RubricComparison />
    </div>
  );
}

export default RubricIntelligenceTab;
