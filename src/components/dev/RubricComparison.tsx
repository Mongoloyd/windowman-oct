/**
 * Dev-only: Rubric version comparison dashboard.
 * Shows grade distribution per rubric_version with stacked bars, deltas,
 * quality score, confidence range, sample warnings, and winner highlight.
 */

import { useState } from "react";
import { useRubricStats, type RubricStatRow } from "@/hooks/useRubricStats";
import { RefreshCw, AlertTriangle, Trophy } from "lucide-react";

if (!import.meta.env.DEV) {
  // Tree-shaken in production
}

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#84cc16",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

const GRADES = ["A", "B", "C", "D", "F"] as const;

const TIME_WINDOWS = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "All", value: null },
] as const;

const MIN_SAMPLE = 10;

function gradeCount(row: RubricStatRow, g: string): number {
  const key = `grade_${g.toLowerCase()}` as keyof RubricStatRow;
  return (row[key] as number) || 0;
}

function pct(count: number, total: number): string {
  if (total === 0) return "0";
  return ((count / total) * 100).toFixed(1);
}

/** Color for quality score: green near 2.0, yellow at extremes */
function scoreColor(score: number | null): string {
  if (score == null) return "#666";
  const dist = Math.abs(score - 2.0);
  if (dist <= 0.3) return "#22c55e";
  if (dist <= 0.8) return "#eab308";
  return "#f97316";
}

function findWinner(rows: RubricStatRow[]): string | null {
  const eligible = rows.filter((r) => {
    const graded = GRADES.reduce((s, g) => s + gradeCount(r, g), 0);
    return graded >= MIN_SAMPLE && r.avg_grade_score != null;
  });
  if (eligible.length < 2) return null;
  // Closest to 2.0 (balanced)
  let best = eligible[0];
  let bestDist = Math.abs((best.avg_grade_score ?? 0) - 2.0);
  for (const row of eligible.slice(1)) {
    const dist = Math.abs((row.avg_grade_score ?? 0) - 2.0);
    if (dist < bestDist) { best = row; bestDist = dist; }
  }
  return best.rubric_version;
}

function GradeBar({ row }: { row: RubricStatRow }) {
  const total = GRADES.reduce((s, g) => s + gradeCount(row, g), 0);
  if (total === 0) return <div style={{ color: "#666", fontSize: 11 }}>No graded scans</div>;

  return (
    <div style={{ display: "flex", height: 20, borderRadius: 4, overflow: "hidden", width: "100%" }}>
      {GRADES.map((g) => {
        const count = gradeCount(row, g);
        if (count === 0) return null;
        const width = `${(count / total) * 100}%`;
        return (
          <div
            key={g}
            title={`${g}: ${count} (${pct(count, total)}%)`}
            style={{
              width,
              background: GRADE_COLORS[g],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#000",
              minWidth: count > 0 ? 18 : 0,
            }}
          >
            {g}
          </div>
        );
      })}
    </div>
  );
}

function DeltaRow({ prev, curr }: { prev: RubricStatRow; curr: RubricStatRow }) {
  const prevTotal = GRADES.reduce((s, g) => s + gradeCount(prev, g), 0);
  const currTotal = GRADES.reduce((s, g) => s + gradeCount(curr, g), 0);
  if (prevTotal === 0 || currTotal === 0) return null;

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "#999", marginTop: 4 }}>
      {GRADES.map((g) => {
        const prevPct = (gradeCount(prev, g) / prevTotal) * 100;
        const currPct = (gradeCount(curr, g) / currTotal) * 100;
        const delta = currPct - prevPct;
        if (Math.abs(delta) < 0.5) return null;
        const sign = delta > 0 ? "+" : "";
        const color = g === "A" || g === "B" ? (delta > 0 ? "#22c55e" : "#ef4444") : delta > 0 ? "#ef4444" : "#22c55e";
        return (
          <span key={g} style={{ color }}>
            {g}: {sign}{delta.toFixed(1)}%
          </span>
        );
      })}
      <span style={{ color: "#666" }}>
        ({prev.rubric_version} → {curr.rubric_version})
      </span>
    </div>
  );
}

export function RubricComparison() {
  const [days, setDays] = useState<number | null>(null);
  const { rows, loading, error, refetch } = useRubricStats(days);
  const winner = findWinner(rows);

  if (!import.meta.env.DEV) return null;

  return (
    <div style={{ padding: 16, border: "1px dashed #555", background: "#0a0a0a", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
        <h3 style={{ color: "#e5e5e5", margin: 0, fontSize: 14, fontWeight: 600 }}>
          📊 Rubric Intelligence Dashboard
        </h3>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {/* Time window toggle */}
          {TIME_WINDOWS.map((tw) => (
            <button
              key={tw.label}
              onClick={() => setDays(tw.value)}
              style={{
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 4,
                border: "1px solid",
                borderColor: days === tw.value ? "#666" : "#333",
                background: days === tw.value ? "#222" : "#111",
                color: days === tw.value ? "#e5e5e5" : "#777",
                cursor: "pointer",
              }}
            >
              {tw.label}
            </button>
          ))}
          <button
            onClick={refetch}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", background: "#1a1a1a", color: "#999",
              border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 12,
              marginLeft: 8,
            }}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && <p style={{ color: "#ef4444", fontSize: 12 }}>Error: {error}</p>}

      {!loading && rows.length === 0 && (
        <p style={{ color: "#666", fontSize: 12 }}>
          No live analysis data visible. This view requires internal operator access and completed analyses rows. Run backend scenarios or real scans while signed in as an operator.
        </p>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333", color: "#999" }}>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Version</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>Total</th>
                <th style={{ textAlign: "center", padding: "6px 8px", color: "#60a5fa" }}>QScore</th>
                {GRADES.map((g) => (
                  <th key={g} style={{ textAlign: "center", padding: "6px 8px", color: GRADE_COLORS[g] }}>{g}</th>
                ))}
                <th style={{ textAlign: "center", padding: "6px 8px" }}>Confidence</th>
                <th style={{ textAlign: "center", padding: "6px 8px" }}>Invalid</th>
                <th style={{ textAlign: "left", padding: "6px 8px", minWidth: 140 }}>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const total = GRADES.reduce((s, g) => s + gradeCount(row, g), 0);
                const isWinner = row.rubric_version === winner;
                const lowSample = total < MIN_SAMPLE;
                return (
                  <tr
                    key={row.rubric_version || "null"}
                    style={{
                      borderBottom: "1px solid #222",
                      color: "#e5e5e5",
                      background: isWinner ? "rgba(34,197,94,0.06)" : undefined,
                    }}
                  >
                    <td style={{ padding: "6px 8px", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      {isWinner && <Trophy size={12} color="#22c55e" />}
                      {row.rubric_version || "—"}
                      {lowSample && (
                        <span title={`Only ${total} graded scans — insufficient for comparison`}>
                          <AlertTriangle size={12} color="#eab308" />
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 8px" }}>{row.total_count}</td>
                    <td style={{ textAlign: "center", padding: "6px 8px", fontWeight: 700, color: scoreColor(row.avg_grade_score) }}>
                      {row.avg_grade_score != null ? row.avg_grade_score : "—"}
                    </td>
                    {GRADES.map((g) => {
                      const count = gradeCount(row, g);
                      return (
                        <td key={g} style={{ textAlign: "center", padding: "6px 8px" }}>
                          {count > 0 ? (
                            <span>
                              {count}{" "}
                              <span style={{ color: "#666", fontSize: 10 }}>({pct(count, total)}%)</span>
                            </span>
                          ) : (
                            <span style={{ color: "#333" }}>0</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "center", padding: "6px 8px", fontSize: 11 }}>
                      {row.avg_confidence != null ? (
                        <span>
                          <span style={{ color: "#666" }}>{row.min_confidence ?? "?"}</span>
                          {" – "}
                          <span style={{ color: "#666" }}>{row.max_confidence ?? "?"}</span>
                          <span style={{ color: "#999" }}> (avg {row.avg_confidence})</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ textAlign: "center", padding: "6px 8px" }}>{row.invalid_count}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <GradeBar row={row} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Delta between consecutive versions */}
          {rows.length >= 2 && (
            <div style={{ marginTop: 12, padding: "8px 8px 0" }}>
              <p style={{ color: "#999", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>VERSION DELTA</p>
              {rows.slice(1).map((curr, i) => (
                <DeltaRow key={curr.rubric_version} prev={rows[i]} curr={curr} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
