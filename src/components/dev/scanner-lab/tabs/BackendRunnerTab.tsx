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
          background: "rgba(251,146,60,0.08)",
          border: "1px solid rgba(251,146,60,0.35)",
          borderRadius: 8,
          padding: "14px 16px",
          marginBottom: 16,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#fb923c",
            letterSpacing: "0.02em",
            marginBottom: 6,
          }}
        >
          Backend Scenario Runner
        </div>
        <div style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.55 }}>
          Requires <code style={{ color: "#F8FAFC", fontFamily: "'DM Mono', ui-monospace, monospace" }}>DEV_BYPASS_SECRET</code> and the deployed{" "}
          <code style={{ color: "#F8FAFC", fontFamily: "'DM Mono', ui-monospace, monospace" }}>dev-create-quote-scenario</code> edge function. This tab writes
          scaffolded dev rows and invokes <code style={{ color: "#F8FAFC", fontFamily: "'DM Mono', ui-monospace, monospace" }}>scan-quote</code> only after you click a scenario.
          Use the <b style={{ color: "#F8FAFC" }}>Local Fixture Brain</b> tab for zero-network scoring.
        </div>
      </div>

      <DevQuoteGenerator sessionId={sessionId} onScanStart={onScanStart} />
    </div>
  );
}

export default BackendRunnerTab;
