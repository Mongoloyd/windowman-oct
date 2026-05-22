/**
 * Lab-only UI for DevReportPreview source=live transport smoke tests.
 * No persistence, no PII in debug output, no production OTP flows.
 */

import type { LabLiveFetchMeta, LabLiveRequestState } from "@/lib/labLiveReportAccess";
import { LAB_LIVE_TRANSFORMER_NAME } from "@/lib/labLiveReportAccess";

export type LabLiveDiagnosticProps = {
  mode: "preview" | "full";
  scanSessionIdPresent: boolean;
  requestState: LabLiveRequestState;
  fetchMeta: LabLiveFetchMeta;
  v2SourceVersion: string | null;
  v2SourcePresent: boolean;
  moduleSourceReady: boolean;
  modulePropsDerived: number;
  transportPath: "preview" | "full";
};

type LabLiveReportAccessPanelProps = {
  mode: "preview" | "full";
  requestState: LabLiveRequestState;
  fetchMeta: LabLiveFetchMeta;
  phoneValue: string;
  onPhoneChange: (value: string) => void;
  onFetchFull: () => void;
  fetchDisabled?: boolean;
  diagnostic: LabLiveDiagnosticProps;
};

function formatAuthorized(value: boolean | "unknown"): string {
  if (value === "unknown") return "unknown";
  return value ? "true" : "false";
}

function formatLocked(value: boolean | "unknown"): string {
  if (value === "unknown") return "unknown";
  return value ? "true" : "false";
}

export function LabLiveTransportDiagnosticStrip({
  diagnostic,
}: {
  diagnostic: LabLiveDiagnosticProps;
}) {
  const rows = [
    ["source", "live"],
    ["mode", diagnostic.mode],
    ["scan_session_id present", diagnostic.scanSessionIdPresent ? "yes" : "no"],
    ["request state", diagnostic.requestState],
    ["authorized", formatAuthorized(diagnostic.fetchMeta.authorized)],
    ["locked", formatLocked(diagnostic.fetchMeta.locked)],
    ["reason/code", diagnostic.fetchMeta.reason ?? diagnostic.fetchMeta.code ?? "—"],
    ["v2_source_version", diagnostic.v2SourceVersion ?? "—"],
    ["v2_source present", diagnostic.v2SourcePresent ? "yes" : "no"],
    ["module source ready", diagnostic.moduleSourceReady ? "yes" : "no"],
    ["module props derived", `${diagnostic.modulePropsDerived}/7`],
    ["transport path", diagnostic.transportPath],
    ["transformer used", LAB_LIVE_TRANSFORMER_NAME],
  ] as const;

  return (
    <section
      role="status"
      aria-label="Live transport diagnostic strip"
      className="mx-auto mb-6 max-w-5xl rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 text-xs font-mono text-slate-300"
    >
      <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-cyan-300">
        Live Transport Diagnostics
      </p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500">{label}:</dt>
            <dd className="break-all text-slate-200">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function LabLiveMissingSessionPanel() {
  return (
    <section
      role="alert"
      className="mx-auto max-w-3xl rounded-2xl border border-red-500/40 bg-slate-950/80 p-8 text-center text-slate-100 shadow-xl"
    >
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-red-300">
        Live Lab · Configuration Error
      </p>
      <h1 className="mt-3 text-2xl font-bold">scan_session_id Required</h1>
      <p className="mt-4 text-sm text-slate-300 leading-relaxed">
        The source=live lab path requires a valid scan_session_id query parameter. No network
        request was made.
      </p>
    </section>
  );
}

export function LabLiveFullLockedPanel({ fetchMeta }: { fetchMeta: LabLiveFetchMeta }) {
  return (
    <section
      role="status"
      className="mx-auto max-w-3xl rounded-2xl border border-amber-500/40 bg-slate-950/80 p-8 text-center text-slate-100 shadow-xl"
    >
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">
        Live Full Report · Locked
      </p>
      <h1 className="mt-3 text-2xl font-bold">Live Full Report Locked</h1>
      <p className="mt-4 text-sm text-slate-300 leading-relaxed">
        report-access returned an unauthorized or locked response for this scan session and phone
        combination. No full report modules were rendered.
      </p>
      <div className="mt-6 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 whitespace-normal break-words rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs text-slate-300">
        {`source:live mode:full authorized:false locked:${formatLocked(fetchMeta.locked)} reason:${fetchMeta.reason ?? "—"} code:${fetchMeta.code ?? "—"}`}
      </div>
    </section>
  );
}

export function LabLiveErrorPanel({ fetchMeta }: { fetchMeta: LabLiveFetchMeta }) {
  return (
    <section
      role="alert"
      className="mx-auto max-w-3xl rounded-2xl border border-red-500/40 bg-slate-950/80 p-8 text-center text-slate-100 shadow-xl"
    >
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-red-300">
        Live Lab · Transport Error
      </p>
      <h1 className="mt-3 text-2xl font-bold">Live Fetch Failed</h1>
      <p className="mt-4 text-sm text-slate-300 leading-relaxed">
        The lab transport request failed or returned no usable payload. No report modules were
        rendered.
      </p>
      <div className="mt-6 inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 whitespace-normal break-words rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs text-slate-300">
        {`source:live code:${fetchMeta.code ?? "—"} reason:${fetchMeta.reason ?? "—"}`}
      </div>
    </section>
  );
}

export function LabLiveLoadingPanel({ mode }: { mode: "preview" | "full" }) {
  return (
    <section
      role="status"
      aria-busy="true"
      className="mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-slate-950/80 p-8 text-center text-slate-100 shadow-xl"
    >
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
        Live Lab · Loading
      </p>
      <h1 className="mt-3 text-2xl font-bold">
        {mode === "preview" ? "Fetching Preview Transport" : "Fetching Authorized Full Report"}
      </h1>
      <p className="mt-4 text-sm text-slate-400 leading-relaxed">
        Waiting for report-access response. Previous live module state has been cleared.
      </p>
    </section>
  );
}

export default function LabLiveReportAccessPanel({
  mode,
  requestState,
  fetchMeta,
  phoneValue,
  onPhoneChange,
  onFetchFull,
  fetchDisabled = false,
  diagnostic,
}: LabLiveReportAccessPanelProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <LabLiveTransportDiagnosticStrip diagnostic={diagnostic} />

      {mode === "full" && requestState !== "loading" && requestState !== "success-full-authorized" ? (
        <section className="rounded-2xl border border-slate-700 bg-slate-950/80 p-6 text-slate-100 shadow-xl">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">
            Live Full Fetch · Lab Only
          </p>
          <h2 className="mt-2 text-lg font-semibold">Enter verified phone (E.164)</h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Phone is kept in ephemeral React state only. It is never written to the URL, storage, or
            debug output.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="mb-1 block text-slate-400">phone_e164</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                spellCheck={false}
                value={phoneValue}
                onChange={(event) => onPhoneChange(event.target.value)}
                placeholder="+15551234567"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-500/40 focus:ring-2"
              />
            </label>
            <button
              type="button"
              onClick={onFetchFull}
              disabled={fetchDisabled || phoneValue.trim().length === 0}
              className="rounded-lg border border-cyan-500/50 bg-cyan-950/40 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Fetch authorized full report
            </button>
          </div>
        </section>
      ) : null}

      {requestState === "loading" ? <LabLiveLoadingPanel mode={mode} /> : null}
      {requestState === "locked" ? <LabLiveFullLockedPanel fetchMeta={fetchMeta} /> : null}
      {requestState === "error" ? <LabLiveErrorPanel fetchMeta={fetchMeta} /> : null}
    </div>
  );
}
