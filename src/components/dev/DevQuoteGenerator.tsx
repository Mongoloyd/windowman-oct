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

      // 1. Get or create lead_id — scan_sessions MUST have a non-null lead_id
      let leadId: string | null = null;
      if (sessionId) {
        const { data: leads } = await supabase.rpc("get_lead_by_session", { p_session_id: sessionId });
        leadId = leads?.[0]?.id || null;
      }
      if (!leadId) {
        const fallbackLeadId = crypto.randomUUID();
        const fallbackSessionId = sessionId || crypto.randomUUID();
        const { error: leadErr } = await supabase
          .from("leads")
          .insert({ id: fallbackLeadId, session_id: fallbackSessionId, source: "dev_bypass" });
        if (leadErr) {
          result.error = `lead creation: ${leadErr.message}`;
          return result;
        }
        leadId = fallbackLeadId;
      }

      // 2. Create placeholder quote_files record
      const quoteFileId = crypto.randomUUID();
      const { error: qfError } = await supabase.from("quote_files").insert({
        id: quoteFileId,
        lead_id: leadId,
        storage_path: `dev-bypass/${fixture.key}/${quoteFileId}.json`,
        status: "pending",
      });
      if (qfError) { result.error = `quote_files: ${qfError.message}`; return result; }

      // 3. Create scan_sessions record
      const scanSessionId = crypto.randomUUID();
      const { error: ssError } = await supabase.from("scan_sessions").insert({
        id: scanSessionId,
        status: "uploading",
        lead_id: leadId,
        quote_file_id: quoteFileId,
      });
      if (ssError) { result.error = `scan_sessions: ${ssError.message}`; return result; }

      // 4. Skip page transition for single runs so results table stays visible

      // 5. Invoke scan-quote with bypass
      const { error: fnError } = await supabase.functions.invoke("scan-quote", {
        body: {
          scan_session_id: scanSessionId,
          dev_extraction_override: fixture.extraction,
          dev_secret: devSecret,
        },
      });

      if (fnError) {
        result.error = `invoke: ${fnError.message}`;
        return result;
      }

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
  }, [sessionId, runningAll, onScanStart]);

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
          ? `Bypass secret: ✓ stored in localStorage | Session: ${sessionId ? sessionId.slice(0, 8) + "…" : "none (will create records without lead)"}`
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
