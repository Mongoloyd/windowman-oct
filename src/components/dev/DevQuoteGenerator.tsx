// /components/dev/DevQuoteGenerator.tsx
// Dev-only: OCR bypass mode + inline result inspector.
// NEVER renders in production.

import { SCENARIO_FIXTURES, type ScenarioFixture } from "@/test/createMockQuote";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getDevSecret, peekDevSecret } from "@/lib/devSecret";

interface RunResult {
  scenarioKey: string;
  expectedGrade: string | null;
  expectedTerminal?: string;
  actualGrade: string | null;
  actualStatus: string | null;
  rubricVersion: string | null;
  flagCount: number;
  pillarScores: Record<string, string> | null;
  hardCap: string | null;
  match: boolean;
  error?: string;
}

interface DevQuoteGeneratorProps {
  sessionId?: string | null;
  onScanStart?: (fileName: string, scanSessionId: string) => void;
}


export function DevQuoteGenerator({ sessionId, onScanStart }: DevQuoteGeneratorProps) {
  const [results, setResults] = useState<RunResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  // One dev_run_id per mounted generator session — namespaces all scaffolded
  // rows + storage paths for future cleanup (>30d sweep, see plan).
  const [devRunId] = useState(() => crypto.randomUUID());

  const runScenario = useCallback(async (fixture: ScenarioFixture): Promise<RunResult> => {
    const result: RunResult = {
      scenarioKey: fixture.key,
      expectedGrade: fixture.expectedGrade,
      expectedTerminal: fixture.expectedTerminal,
      actualGrade: null,
      actualStatus: null,
      rubricVersion: null,
      flagCount: 0,
      pillarScores: null,
      hardCap: null,
      match: false,
    };

    try {
      // Prompts once per browser if not yet stored. Cancel → fall back cleanly.
      const devSecret = getDevSecret();
      if (!devSecret) {
        result.error = "DEV bypass cancelled (no secret stored)";
        return result;
      }

      // All scaffolding now happens server-side in dev-create-quote-scenario
      // (service-role) so RLS is never weakened. Browser only invokes the
      // dev edge function; lead/quote_file/scan_session inserts run there.
      const { data: scaffold, error: fnError } = await supabase.functions.invoke(
        "dev-create-quote-scenario",
        {
          body: {
            scenario_key: fixture.key,
            dev_secret: devSecret,
            dev_run_id: devRunId,
            dev_extraction_override: fixture.extraction,
            existing_session_id: sessionId ?? null,
          },
        },
      );

      if (fnError) {
        result.error = `invoke: ${fnError.message}`;
        return result;
      }
      const scaffoldObj = scaffold as { ok?: boolean; error?: string; scan_session_id?: string; details?: unknown } | null;
      if (!scaffoldObj?.ok || !scaffoldObj.scan_session_id) {
        result.error = `scaffold: ${scaffoldObj?.error || "unknown"}${scaffoldObj?.details ? ` (${JSON.stringify(scaffoldObj.details).slice(0, 120)})` : ""}`;
        return result;
      }
      const scanSessionId = scaffoldObj.scan_session_id;

      // 6. Fetch result via get_analysis_preview
      const { data: rows, error: rpcErr } = await supabase.rpc("get_analysis_preview", {
        p_scan_session_id: scanSessionId,
      });

      if (rpcErr || !rows || (Array.isArray(rows) && rows.length === 0)) {
        // Check scan status for terminal states
        const { data: statusRows } = await supabase.rpc("get_scan_status", {
          p_scan_session_id: scanSessionId,
        });
        const scanStatus = statusRows?.[0]?.status || "unknown";
        result.actualStatus = scanStatus;

        if (fixture.expectedTerminal && scanStatus === fixture.expectedTerminal) {
          result.match = true;
        }
        return result;
      }

      const row = Array.isArray(rows) ? rows[0] : rows;
      result.actualGrade = row.grade;
      result.actualStatus = "complete";
      result.rubricVersion = row.rubric_version || null;
      result.flagCount = row.flag_count ?? 0;

      // Extract pillar scores and hard cap from preview_json
      const preview = row.preview_json as Record<string, unknown> | null;
      if (preview?.pillar_scores && typeof preview.pillar_scores === "object") {
        const ps = preview.pillar_scores as Record<string, { status?: string }>;
        result.pillarScores = {};
        for (const [key, val] of Object.entries(ps)) {
          result.pillarScores[key] = val?.status || "?";
        }
      }
      result.hardCap = (preview?.hard_cap_applied as string) || null;

      // Check match
      if (fixture.expectedGrade) {
        result.match = row.grade === fixture.expectedGrade;
      }

      return result;
    } catch (err) {
      result.error = String(err);
      return result;
    }
  }, [sessionId, devRunId]);

  const handleRunSingle = async (fixture: ScenarioFixture) => {
    setRunning(fixture.key);
    const result = await runScenario(fixture);
    setResults(prev => {
      const filtered = prev.filter(r => r.scenarioKey !== fixture.key);
      return [...filtered, result];
    });
    setRunning(null);

    if (result.error) toast.error(`${fixture.key}: ${result.error}`);
    else if (result.match) toast.success(`${fixture.key}: ✅ ${result.actualGrade || result.actualStatus}`);
    else toast.warning(`${fixture.key}: expected ${fixture.expectedGrade || fixture.expectedTerminal}, got ${result.actualGrade || result.actualStatus}`);
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    setResults([]);
    const allResults: RunResult[] = [];

    for (const fixture of SCENARIO_FIXTURES) {
      setRunning(fixture.key);
      const result = await runScenario(fixture);
      allResults.push(result);
      setResults([...allResults]);
    }

    setRunning(null);
    setRunningAll(false);

    const matches = allResults.filter(r => r.match).length;
    toast.info(`Run All complete: ${matches}/${allResults.length} matched`);
  };

  const getResultForKey = (key: string) => results.find(r => r.scenarioKey === key);

  if (!import.meta.env.DEV) return null;

  return (
    <div style={{ padding: 16, border: "1px dashed #555", marginTop: 24, background: "#0a0a0a", maxWidth: 800 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 style={{ color: "#e5e5e5", margin: 0 }}>🧪 Dev Quote Generator (OCR Bypass)</h3>
        <button
          onClick={handleRunAll}
          disabled={!!running || runningAll}
          style={{
            padding: "6px 16px",
            background: runningAll ? "#333" : "#2563EB",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: runningAll ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {runningAll ? "Running..." : "▶ Run All Scenarios"}
        </button>
      </div>

      <p style={{ color: "#999", fontSize: 12, marginBottom: 12 }}>
        {peekDevSecret()
          ? `Bypass secret: ✓ | dev_run_id: ${devRunId.slice(0, 8)}… | Session: ${sessionId ? sessionId.slice(0, 8) + "…" : "server-scaffolded"}`
          : "⚠️ Click a scenario — you'll be prompted once for DEV_BYPASS_SECRET (stored in localStorage.wm_dev_secret)"}
      </p>

      {/* Scenario buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {SCENARIO_FIXTURES.map((fixture) => {
          const result = getResultForKey(fixture.key);
          const isRunning = running === fixture.key;
          const bgColor = isRunning ? "#333" : result ? (result.match ? "#14532d" : "#7f1d1d") : "#1a1a1a";

          return (
            <button
              key={fixture.key}
              onClick={() => handleRunSingle(fixture)}
              disabled={!!running}
              title={fixture.description}
              style={{
                padding: "5px 10px",
                background: bgColor,
                color: "#e5e5e5",
                border: `1px solid ${result?.match ? "#22c55e" : result ? "#ef4444" : "#333"}`,
                borderRadius: 4,
                cursor: running ? "not-allowed" : "pointer",
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {isRunning ? "⏳" : result ? (result.match ? "✅" : "❌") : "○"}{" "}
              {fixture.label}
              {fixture.expectedGrade ? ` → ${fixture.expectedGrade}` : ` → ${fixture.expectedTerminal}`}
            </button>
          );
        })}
      </div>

      {/* Results table */}
      {results.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333", color: "#999" }}>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Scenario</th>
                <th style={{ textAlign: "center", padding: "4px 8px" }}>Expected</th>
                <th style={{ textAlign: "center", padding: "4px 8px" }}>Actual</th>
                <th style={{ textAlign: "center", padding: "4px 8px" }}>Match</th>
                <th style={{ textAlign: "center", padding: "4px 8px" }}>Flags</th>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Pillars</th>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Hard Cap</th>
                <th style={{ textAlign: "center", padding: "4px 8px" }}>Rubric</th>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.scenarioKey} style={{ borderBottom: "1px solid #222", color: "#e5e5e5" }}>
                  <td style={{ padding: "4px 8px" }}>{r.scenarioKey}</td>
                  <td style={{ textAlign: "center", padding: "4px 8px" }}>{r.expectedGrade || r.expectedTerminal}</td>
                  <td style={{ textAlign: "center", padding: "4px 8px", color: r.match ? "#22c55e" : "#ef4444" }}>
                    {r.actualGrade || r.actualStatus || "—"}
                  </td>
                  <td style={{ textAlign: "center", padding: "4px 8px" }}>{r.match ? "✅" : "❌"}</td>
                  <td style={{ textAlign: "center", padding: "4px 8px" }}>{r.flagCount}</td>
                  <td style={{ padding: "4px 8px", fontSize: 11 }}>
                    {r.pillarScores
                      ? Object.entries(r.pillarScores).map(([k, v]) => (
                          <span key={k} style={{ marginRight: 6, color: v === "pass" ? "#22c55e" : v === "warn" ? "#eab308" : v === "fail" ? "#ef4444" : "#666" }}>
                            {k.replace(/_/g, "").slice(0, 3)}:{v}
                          </span>
                        ))
                      : "—"}
                  </td>
                  <td style={{ padding: "4px 8px", fontSize: 11, color: r.hardCap ? "#f97316" : "#555", whiteSpace: "nowrap" }}>
                    {r.hardCap || "—"}
                  </td>
                  <td style={{ textAlign: "center", padding: "4px 8px", fontSize: 11, color: "#C8952A" }}>
                    {r.rubricVersion || "—"}
                  </td>
                  <td style={{ padding: "4px 8px", color: "#ef4444", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.error || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
