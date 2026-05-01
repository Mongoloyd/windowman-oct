/**
 * Scanner Lab — Tab 3: Backend Scenario Runner
 *
 * Pure wrapper around the existing DevQuoteGenerator. Renders a static
 * informational banner + DevQuoteGenerator. No state, no effects, no
 * network logic. Network calls only fire when the user explicitly clicks
 * a scenario inside DevQuoteGenerator (existing, unchanged behavior:
 * supabase.functions.invoke("dev-create-quote-scenario") +
 * supabase.rpc("get_analysis_preview")).
 *
 * sessionId is passed through unchanged — never generated here.
 *
 * DEV-only: parent ScannerLab is mounted lazily behind import.meta.env.DEV
 * via DevPreviewPanel. DevQuoteGenerator additionally self-gates with
 * `if (!import.meta.env.DEV) return null;`.
 */

import { DevQuoteGenerator } from "@/components/dev/DevQuoteGenerator";

interface BackendRunnerTabProps {
  sessionId?: string | null;
  onScanStart?: (fileName: string, scanSessionId: string) => void;
}

export function BackendRunnerTab({ sessionId, onScanStart }: BackendRunnerTabProps) {
  return (
    <div>
      {/* Static informational banner — pure text, no links, no buttons, no logic */}
      <div
        style={{
          background: "rgba(249,115,22,0.08)",
          border: "1px solid rgba(249,115,22,0.35)",
          borderRadius: 6,
          padding: "10px 12px",
          marginBottom: 12,
          fontFamily: "'DM Mono', monospace",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#f97316",
            letterSpacing: "0.04em",
            marginBottom: 4,
          }}
        >
          Backend Scenario Runner
        </div>
        <div style={{ fontSize: 11, color: "#a3a3a3", lineHeight: 1.45 }}>
          Requires <span style={{ color: "#e5e5e5" }}>DEV_BYPASS_SECRET</span> and deployed{" "}
          <span style={{ color: "#e5e5e5" }}>dev-create-quote-scenario</span>. This tab writes
          scaffolded dev rows and invokes <span style={{ color: "#e5e5e5" }}>scan-quote</span>.
          Use <span style={{ color: "#e5e5e5" }}>Local Fixture Brain</span> for zero-network
          scoring.
        </div>
      </div>

      <DevQuoteGenerator sessionId={sessionId} onScanStart={onScanStart} />
    </div>
  );
}

export default BackendRunnerTab;
