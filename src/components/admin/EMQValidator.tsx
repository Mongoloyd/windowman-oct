import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, ChevronDown, Clipboard, Info, Radar, ShieldAlert } from "lucide-react";
import type { CapiDiagnosticCode, SignalEventRow } from "@/services/signalDispatch";
import {
  CAPI_DIAGNOSTIC_DEFINITIONS,
  aggregateCapiIntelligence,
  buildCopySafeDiagnostic,
  buildHumanGatedRecommendation,
  calculateEmqScore,
  getRemediationPlaybook,
  platformOutcomeLabel,
  selectCapiRows,
  type CapiIntelligenceSummary,
  type EmqScoreResult,
} from "@/utils/capiScoring";

export interface EMQValidatorProps {
  events: SignalEventRow[];
  isLoading: boolean;
  error: string | null;
}

interface ScoredEvent {
  row: SignalEventRow;
  result: EmqScoreResult;
  reasons: CapiDiagnosticCode[];
}

type CopyStatus = "idle" | "copied" | "failed" | "unavailable";

function timestampValue(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatTimestamp(value: unknown): string {
  const timestamp = timestampValue(value);
  return timestamp === null ? "Invalid timestamp" : format(new Date(timestamp), "MMM d, h:mm:ss a");
}

function scoreClasses(score: number | null): string {
  if (score === null) return "border-slate-500 bg-slate-700/70 text-slate-100";
  if (score >= 8) return "border-emerald-300/70 bg-emerald-400/15 text-emerald-200";
  if (score >= 4) return "border-yellow-300/70 bg-yellow-400/15 text-yellow-100";
  return "border-red-300/70 bg-red-400/15 text-red-200";
}

function safeReasons(row: SignalEventRow): CapiDiagnosticCode[] {
  const reasonCodes = row.capiDiagnostics?.reasonCodes;
  if (!Array.isArray(reasonCodes)) return [];
  return [...new Set(reasonCodes.filter((code): code is CapiDiagnosticCode => typeof code === "string" && code in CAPI_DIAGNOSTIC_DEFINITIONS))];
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading Meta CAPI match readiness" className="space-y-2">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-14 animate-pulse rounded-xl border border-slate-700 bg-slate-800/80" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div data-testid="emq-empty-state" className="rounded-xl border border-dashed border-slate-500 bg-slate-950/70 px-4 py-8 text-center">
      <Radar aria-hidden className="mx-auto h-7 w-7 !text-blue-200" />
      <p className="mt-3 text-sm font-black !text-white">No Meta CAPI dispatch rows found</p>
      <p className="mt-1 text-sm font-semibold leading-6 !text-white">The validator shows only existing capi_signal_logs evidence. No sample data is generated.</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 break-words text-lg font-black text-white">{value}</div>
    </div>
  );
}

function severityClasses(severity: "error" | "warning" | "info"): string {
  if (severity === "error") return "border-red-400/40 bg-red-400/10 text-red-100";
  if (severity === "warning") return "border-yellow-300/40 bg-yellow-300/10 text-yellow-100";
  return "border-blue-300/40 bg-blue-300/10 text-blue-100";
}

function CopyDiagnosticButton({ summary }: { summary: CapiIntelligenceSummary }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const copyText = useMemo(() => buildCopySafeDiagnostic(summary), [summary]);

  async function copyDiagnostic() {
    if (!navigator.clipboard?.writeText) {
      setStatus("unavailable");
      return;
    }
    try {
      await navigator.clipboard.writeText(copyText);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  const statusText = status === "copied" ? "Diagnostic copied"
    : status === "failed" ? "Copy failed"
      : status === "unavailable" ? "Copy unavailable"
        : "";

  return (
    <div>
      <button
        type="button"
        onClick={copyDiagnostic}
        aria-describedby="emq-copy-status"
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-black transition-all focus-visible:outline-none focus-visible:ring-4 ${status === "copied"
          ? "border-emerald-300/70 bg-emerald-400/15 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.12)] hover:bg-emerald-400/20 focus-visible:ring-emerald-400/40"
          : "border-blue-300/50 bg-blue-400/10 text-blue-100 hover:bg-blue-400/20 focus-visible:ring-blue-400/40"
        }`}
      >
        {status === "copied" ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : <Clipboard aria-hidden className="h-4 w-4" />}
        Copy safe diagnostic
      </button>
      <span id="emq-copy-status" aria-live="polite" className={`ml-3 text-sm font-black ${status === "copied"
        ? "text-emerald-200"
        : status === "failed"
          ? "text-red-200"
          : status === "unavailable"
            ? "text-yellow-100"
            : "text-slate-100"
      }`}>
        {statusText}
      </span>
    </div>
  );
}

function IntelligencePanel({ summary }: { summary: CapiIntelligenceSummary }) {
  const dominantDefinition = summary.dominantIssue ? CAPI_DIAGNOSTIC_DEFINITIONS[summary.dominantIssue] : null;
  const dominantPlaybook = summary.dominantIssue ? getRemediationPlaybook(summary.dominantIssue) : null;
  const recommendation = useMemo(() => buildHumanGatedRecommendation(summary), [summary]);

  return (
    <div data-testid="emq-intelligence" className="space-y-4 rounded-xl border border-slate-600 bg-slate-950/65 p-4">
      <div>
        <h4 className="text-sm font-black uppercase tracking-[0.14em] text-blue-200">Fetched-sample intelligence</h4>
        <p className="mt-1 text-sm font-semibold text-slate-300">Based on {summary.sampleSize} CAPI rows in the current fetched sample. This is not an all-history claim.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="CAPI sample" value={summary.sampleSize} />
        <Metric label="Rows with actionable issues" value={summary.actionableIssueCount} />
        <Metric label="Integrity healthy" value={summary.integrityHealthyCount} />
        <Metric label="Unable to score" value={summary.unscorableCount} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <h5 className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Dominant actionable issue</h5>
          {summary.dominantIssue && dominantDefinition ? (
            <div className="mt-2 space-y-2">
              <code className="break-all text-sm font-black text-white">{summary.dominantIssue}</code>
              <p className="text-sm font-semibold text-slate-200"><span className="font-black">OBSERVED:</span> {dominantDefinition.evidenceLabel}</p>
              <p className="text-sm font-semibold text-slate-300"><span className="font-black text-slate-100">LIKELY CAUSE — INFERRED:</span> {dominantDefinition.likelyCause ?? "NEEDS REPO VERIFICATION"}</p>
              <p className="text-sm font-semibold text-slate-300"><span className="font-black text-slate-100">CONFIDENCE:</span> {dominantDefinition.confidence}</p>
            </div>
          ) : <p className="mt-2 text-sm font-semibold text-slate-300">No error or warning code is dominant in this sample.</p>}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
          <h5 className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Current failure streaks</h5>
          {summary.currentStreaks.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-200">
              {summary.currentStreaks.map((streak) => <li key={streak.code}><code className="font-black">{streak.code}</code>: {streak.count} newest consecutive {streak.count === 1 ? "row" : "rows"}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm font-semibold text-slate-300">No current reason-code streak.</p>}
        </div>
      </div>

      {summary.recovery.recovered ? (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-100">
          <CheckCircle2 aria-hidden className="mr-2 inline h-4 w-4" />
          Recovery observed in the fetched sample: the newest {summary.recovery.healthyRunLength} events are integrity-healthy after an earlier failure. This does not prove the production pipeline is permanently fixed.
        </div>
      ) : null}

      <div>
        <h5 className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Top diagnostic frequencies</h5>
        {summary.frequencies.length > 0 ? (
          <ul className="mt-2 grid gap-2 lg:grid-cols-2">
            {summary.frequencies.slice(0, 6).map((frequency) => (
              <li key={frequency.code} className="rounded-lg border border-slate-700 bg-slate-900/70 p-2.5 text-sm font-semibold text-slate-200">
                {frequency.count} of {frequency.denominator} rows ({frequency.percentage}%) had <code className="break-all font-black text-white">{frequency.code}</code>.
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm font-semibold text-slate-300">No diagnostic reasons in the current sample.</p>}
      </div>

      {dominantPlaybook ? (
        <div className="space-y-2 rounded-xl border border-blue-300/30 bg-blue-400/5 p-3 text-sm text-slate-200">
          <p><span className="font-black text-white">Recommended inspection:</span> {dominantPlaybook.recommendedInspection}</p>
          <p><span className="font-black text-white">Protected-system trigger:</span> YES — measurement/CAPI.</p>
          <p><span className="font-black text-white">Smallest safe next sprint:</span> {dominantPlaybook.smallestSafeNextSprint}</p>
        </div>
      ) : null}

      <details className="rounded-xl border border-slate-700 bg-slate-900/70">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-black text-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 [&::-webkit-details-marker]:hidden">
          Human-gated recommendation brief
          <ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <pre className="whitespace-pre-wrap break-words border-t border-slate-700 p-3 text-xs font-semibold leading-5 text-slate-300">{recommendation}</pre>
      </details>

      <CopyDiagnosticButton summary={summary} />
    </div>
  );
}

function MatchLedger({ result }: { result: EmqScoreResult }) {
  return (
    <div>
      <h4 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Why this score?</h4>
      <div className="mt-2 overflow-hidden rounded-lg border border-slate-700">
        {result.ledger.map((entry) => {
          const isReady = entry.availablePoints > 0 && entry.earnedPoints === entry.availablePoints;
          return (
            <div
              key={entry.key}
              data-factor-status={isReady ? "ready" : "unavailable"}
              className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-800 px-3 py-2 text-sm last:border-b-0 ${isReady
                ? "bg-emerald-400/10 shadow-[inset_3px_0_0_rgba(52,211,153,0.8)]"
                : "bg-slate-900/70"
              }`}
            >
              <div className="min-w-0">
                <div className={`flex items-center gap-2 font-bold ${isReady ? "text-emerald-100" : "text-slate-100"}`}>
                  {isReady ? <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-emerald-300" /> : null}
                  <span>{entry.label}</span>
                </div>
                <div className={`text-xs font-semibold ${isReady ? "text-emerald-200" : "text-slate-200"}`}>{entry.statusLabel}</div>
              </div>
              <div className={`self-center font-mono font-black ${isReady ? "text-emerald-200" : "text-slate-100"}`}>{entry.earnedPoints} / {entry.availablePoints}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DispatchFindings({ reasons }: { reasons: CapiDiagnosticCode[] }) {
  return (
    <div>
      <h4 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Dispatch Integrity</h4>
      {reasons.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {reasons.map((code) => {
            const definition = CAPI_DIAGNOSTIC_DEFINITIONS[code];
            return (
              <li key={code} className={`rounded-lg border p-3 ${severityClasses(definition.severity)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="break-all text-xs font-black">{code}</code>
                  <span className="rounded border border-current/30 px-1.5 py-0.5 text-[10px] font-black uppercase">{definition.severity}</span>
                </div>
                <p className="mt-1 text-sm font-semibold"><span className="font-black">OBSERVED:</span> {definition.evidenceLabel}</p>
                {definition.likelyCause ? <p className="mt-1 text-xs font-semibold opacity-90"><span className="font-black">LIKELY CAUSE — INFERRED:</span> {definition.likelyCause}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-2 text-sm font-semibold text-emerald-200">No local diagnostic findings in this logged row.</p>}
    </div>
  );
}

function InspectionGuidance({ reasons }: { reasons: CapiDiagnosticCode[] }) {
  const playbook = reasons.map(getRemediationPlaybook).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  if (playbook.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Recommended inspection</h4>
      <div className="mt-2 space-y-2">
        {playbook.map((entry) => (
          <div key={entry.code} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-200">
            <code className="text-xs font-black text-white">{entry.code}</code>
            <p className="mt-1 font-semibold">{entry.recommendedInspection}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">CONFIDENCE: {entry.confidence} observed; upstream cause remains INFERRED. PROTECTED SYSTEM TRIGGER: YES.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoredEventRow({ scored, index }: { scored: ScoredEvent; index: number }) {
  const { row, result, reasons } = scored;
  const scoreLabel = result.score === null ? "Unable to score" : `${result.score}/${result.max}`;
  const accessibleScore = result.score === null ? "Unable to score" : `${result.score} out of ${result.max}`;
  const outcome = platformOutcomeLabel(row.httpStatus);
  const actionable = reasons.some((code) => CAPI_DIAGNOSTIC_DEFINITIONS[code].severity !== "info");
  const isIntegrityHealthy = row.capiDiagnostics?.scorable === true && !actionable;
  const isHttpAccepted = typeof row.httpStatus === "number" && row.httpStatus >= 200 && row.httpStatus < 300;
  const isHttpRejected = typeof row.httpStatus === "number" && row.httpStatus >= 400 && row.httpStatus < 500;

  return (
    <details data-testid={`emq-row-${index}`} className="group rounded-xl border border-slate-700 bg-slate-900/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_28px_rgba(2,6,23,0.2)]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-100">{typeof row.eventType === "string" && row.eventType.trim() ? row.eventType : "Unknown event"}</p>
          <time dateTime={typeof row.timestamp === "string" ? row.timestamp : undefined} className="mt-0.5 block text-xs font-semibold text-slate-400">{formatTimestamp(row.timestamp)}</time>
        </div>
        <span aria-label={accessibleScore} className={`inline-flex min-h-8 shrink-0 items-center rounded-lg border px-2.5 py-1 font-mono text-xs font-black ${scoreClasses(result.score)}`}>
          {scoreLabel}
        </span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-5 border-t border-slate-700 bg-slate-950/60 px-4 py-4">
        <MatchLedger result={result} />
        {isIntegrityHealthy ? (
          <div data-integrity-status="healthy" className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm font-bold text-emerald-100">
            <CheckCircle2 aria-hidden className="mr-2 inline h-4 w-4" />
            No integrity warnings detected in this logged row.
          </div>
        ) : null}
        <DispatchFindings reasons={reasons} />

        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Platform Outcome</h4>
          <div
            data-platform-outcome={isHttpAccepted ? "accepted" : "not-accepted"}
            className={`mt-2 rounded-lg border p-3 text-sm font-semibold ${isHttpAccepted
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
              : "border-slate-700 bg-slate-900/70 text-slate-200"
            }`}
          >
            <p>{isHttpAccepted ? <CheckCircle2 aria-hidden className="mr-2 inline h-4 w-4" /> : null}{outcome}</p>
            <p className={`mt-1 text-xs ${isHttpAccepted ? "text-emerald-100" : "text-slate-200"}`}>HTTP evidence is separate from local validation. A 2xx response does not prove attribution, deduplication, conversion credit, match quality, or Meta-reported EMQ.</p>
            {actionable && isHttpRejected ? <p className="mt-1 text-xs font-black text-yellow-100">Observed in the same logged event; causal relationship not proven.</p> : null}
          </div>
        </div>

        <InspectionGuidance reasons={reasons} />

        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs font-semibold text-slate-300">
          <span className="font-black text-slate-100">Confidence:</span> field shapes and reason codes are OBSERVED. Likely upstream causes are INFERRED. Meta attribution and Meta-reported EMQ remain UNKNOWN here.
        </div>
      </div>
    </details>
  );
}

function ValidatorResults({ events }: { events: SignalEventRow[] }) {
  const allCapiRows = useMemo(() => selectCapiRows(Array.isArray(events) ? events : []), [events]);
  const summary = useMemo(() => aggregateCapiIntelligence(Array.isArray(events) ? events : []), [events]);
  const scoredEvents = useMemo<ScoredEvent[]>(() => allCapiRows.slice(0, 20).map((row) => ({
    row,
    result: calculateEmqScore(row.matchKeys, row.capiDiagnostics),
    reasons: safeReasons(row),
  })), [allCapiRows]);

  if (allCapiRows.length === 0) return <EmptyState />;

  return (
    <div className="space-y-4">
      <IntelligencePanel summary={summary} />
      <div className="space-y-2" aria-label="Latest 20 CAPI diagnostic rows">
        {scoredEvents.map((scored, index) => <ScoredEventRow key={scored.row.id} scored={scored} index={index} />)}
      </div>
    </div>
  );
}

export function EMQValidator({ events, isLoading, error }: EMQValidatorProps) {
  return (
    <section aria-labelledby="emq-validator-title" className="overflow-hidden rounded-2xl border border-slate-700 bg-[radial-gradient(circle_at_top_right,rgba(53,106,195,0.22),transparent_42%),linear-gradient(145deg,#111827,#020617)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_45px_rgba(15,23,42,0.28)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radar aria-hidden className="h-5 w-5 text-blue-300" />
            <h3 id="emq-validator-title" className="text-lg font-black tracking-tight text-white">Meta CAPI Match Readiness</h3>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-300">Internal estimate—not Meta-reported EMQ. Match points, dispatch integrity, and HTTP outcome are evaluated separately.</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold !text-white"><Info aria-hidden className="h-4 w-4 shrink-0 !text-blue-200" />WindowMan diagnostic codes—not Meta response codes.</p>
        </div>
        <span className="rounded-lg border border-blue-300/40 bg-blue-400/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-blue-100">Latest 20</span>
      </div>

      {isLoading ? <LoadingState /> : error ? (
        <div role="alert" className="rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm font-bold text-red-100">
          <AlertTriangle aria-hidden className="mr-2 inline h-4 w-4" />
          Match readiness could not be calculated because signal rows failed to load.
        </div>
      ) : <ValidatorResults events={events} />}

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-300/30 bg-blue-950/40 p-3 text-sm font-semibold leading-6 !text-white">
        <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 !text-blue-200" />
        This panel diagnoses existing sanitized logs only. It does not repair, resend, reroute, or modify Meta events.
      </div>
    </section>
  );
}
