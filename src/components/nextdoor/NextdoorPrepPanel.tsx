import { ClipboardList, Lock, UploadCloud } from "lucide-react";
import type { AreaContext } from "@/lib/nextdoor/areaContext";
import { prepPanelAreaPhrase } from "@/lib/nextdoor/areaContext";
import type { QuoteReadiness } from "./types";

const CHECKLIST_ITEMS = [
  "Ask who pulls permits and who schedules inspections.",
  "Confirm product approvals and ratings shown on the quote.",
  "Clarify deposit timing, draw schedule, and final payment triggers.",
  "Check warranty length, transferability, and labor vs. product coverage.",
  "Compare line items — removals, trim, stucco repair, and exclusions.",
  "Request written scope for labor, materials, and cleanup.",
] as const;

const ANATOMY_ITEMS = [
  "What labor vs. materials are actually included?",
  "Are permit fees listed or assumed?",
  "Is there a product approval number or DP rating reference?",
  "What triggers the final payment?",
  "What warranty language is missing or vague?",
] as const;

type PrepPanelProps = {
  readiness: QuoteReadiness;
  showChecklist: boolean;
  onShowChecklist: () => void;
  primary?: boolean;
  attributionSaveUrl?: string;
  areaContext: AreaContext;
};

function UploadPlaceholder() {
  return (
    <div
      className="mt-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-8 text-center shadow-inner"
      aria-hidden="true"
    >
      <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-3 text-sm font-semibold text-slate-700">Drop your estimate here</p>
      <p className="mt-1 text-xs text-slate-500">PDF · photo · screenshot — wiring arrives next release</p>
      <span className="mt-4 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-900">
        Local preview only
      </span>
    </div>
  );
}

function AttributionSaveLink({ url }: { url: string }) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200/80 bg-slate-50/80 px-4 py-3">
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Attribution-safe return link
      </p>
      <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-slate-700">
        {url}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Bookmark or copy this link to return without losing Nextdoor attribution. No personal details
        are included in the URL.
      </p>
    </div>
  );
}

export function NextdoorQuoteReadyPanel({
  identitySubmitted,
  attributionSaveUrl,
}: {
  identitySubmitted: boolean;
  attributionSaveUrl?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-white via-white to-primary/5 p-6 shadow-[0_12px_40px_-16px_rgba(37,99,235,0.35)] md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
          Quote-ready path
        </span>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-900">
          Upload next
        </span>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <UploadCloud className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900 md:text-2xl">
            Next step: upload your estimate
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">
            We&apos;ll review your quote and show a useful preview first. You decide what to do next.
          </p>
        </div>
      </div>

      <UploadPlaceholder />

      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Upload wiring arrives in a later pass"
        className="btn-depth-primary mt-6 w-full opacity-55 sm:w-auto"
        style={{ padding: "14px 28px", fontSize: 15, cursor: "not-allowed" }}
      >
        Continue to upload
      </button>
      <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {identitySubmitted
          ? "Upload connects in the next release. No file is sent in this preview shell."
          : "Save your details above first — upload connects in the next release."}
      </p>
      {attributionSaveUrl ? <AttributionSaveLink url={attributionSaveUrl} /> : null}
    </div>
  );
}

function panelCopy(readiness: QuoteReadiness, areaContext: AreaContext) {
  const areaPhrase = prepPanelAreaPhrase(areaContext);

  switch (readiness) {
    case "getting_quotes_now":
      return {
        badge: "Comparison mode",
        headline: "Get a quick comparison checklist before the next bid arrives.",
        body: "Use the same scope language across bids so you are comparing apples to apples.",
        cta: "Show my checklist",
        items: CHECKLIST_ITEMS,
      };
    case "need_quote_soon":
      return {
        badge: "Pre-visit prep",
        headline: "Prep the questions that make quotes easier to compare.",
        body: "Bring these to your next in-home visit — no upload required today.",
        cta: "Show prep questions",
        items: CHECKLIST_ITEMS,
      };
    case "researching":
      return {
        badge: "Quote anatomy",
        headline: "Learn what a clean impact-window quote should include.",
        body: `See what belongs on a quote in ${areaPhrase} before you sign anything — no upload required today.`,
        cta: "Show quote anatomy",
        items: ANATOMY_ITEMS,
      };
    default:
      return {
        badge: "Checklist",
        headline: "Use the checklist before contractors come out.",
        body: "Compare quotes with the same scope language before you choose a contractor.",
        cta: "Show my checklist",
        items: CHECKLIST_ITEMS,
      };
  }
}

export function NextdoorPrepPanel({
  readiness,
  showChecklist,
  onShowChecklist,
  primary = false,
  attributionSaveUrl,
  areaContext,
}: PrepPanelProps) {
  const copy = panelCopy(readiness, areaContext);

  return (
    <div
      className={[
        "overflow-hidden rounded-xl border p-6 md:p-8",
        primary
          ? "border-emerald-500/25 bg-gradient-to-br from-white via-emerald-50/30 to-white shadow-[0_12px_40px_-16px_rgba(16,185,129,0.2)]"
          : "border-slate-200/90 bg-gradient-to-br from-white to-slate-50/80 shadow-[0_10px_36px_-14px_rgba(15,23,42,0.16)]",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
          {copy.badge}
        </span>
        {primary ? (
          <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            No upload required
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
          <ClipboardList className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900 md:text-2xl">
            {copy.headline}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy.body}</p>
        </div>
      </div>

      {!showChecklist ? (
        <button
          type="button"
          onClick={onShowChecklist}
          className="mt-6 w-full rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-[0_4px_12px_-6px_rgba(15,23,42,0.2)] transition-all hover:border-primary/40 hover:shadow-md sm:w-auto"
        >
          {copy.cta}
        </button>
      ) : (
        <>
          <ul className="mt-6 space-y-2.5">
            {copy.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 rounded-lg border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm"
              >
                <span
                  className="mt-0.5 font-mono text-[10px] font-bold uppercase text-amber-600"
                  aria-hidden="true"
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          {attributionSaveUrl ? <AttributionSaveLink url={attributionSaveUrl} /> : null}
        </>
      )}
    </div>
  );
}
