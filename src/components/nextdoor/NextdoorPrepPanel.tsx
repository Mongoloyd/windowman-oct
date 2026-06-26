import { ClipboardList, UploadCloud } from "lucide-react";
import { nextStepPanelCopy } from "@/lib/nextdoor/pathRouter";
import { hasTrustedContactIdentity } from "@/components/TruthGateFlow";
import { NextdoorQuoteUpload } from "./NextdoorQuoteUpload";
import type { QuoteReadiness } from "./types";
import { nextdoorPrimaryCtaClass, nextdoorSecondaryCtaClass } from "./nextdoorUi";

const CHECKLIST_ITEMS = [
  "Ask who pulls permits and who schedules inspections.",
  "Confirm product approvals and ratings shown on the quote.",
  "Clarify deposit timing, draw schedule, and final payment triggers.",
  "Check warranty length, transferability, and labor vs. product coverage.",
  "Compare line items — removals, trim, stucco repair, and exclusions.",
  "Request written scope for labor, materials, and cleanup.",
] as const;

const SALES_VISIT_ITEMS = [
  "What product line and approval numbers are you quoting?",
  "Who pulls permits and schedules inspections?",
  "What is included in labor vs. materials?",
  "What triggers deposit, progress payments, and final balance?",
  "What warranty covers product, labor, glass, and installation?",
  "What exclusions or assumptions should be written into scope?",
] as const;

const ANATOMY_ITEMS = [
  "What labor vs. materials are actually included?",
  "Are permit fees listed or assumed?",
  "Is there a product approval number or DP rating reference?",
  "What triggers the final payment?",
  "What warranty language is missing or vague?",
] as const;

function checklistItems(readiness: QuoteReadiness): readonly string[] {
  switch (readiness) {
    case "need_quote_soon":
      return SALES_VISIT_ITEMS;
    case "researching":
      return ANATOMY_ITEMS;
    default:
      return CHECKLIST_ITEMS;
  }
}

type PrepPanelProps = {
  readiness: QuoteReadiness;
  showChecklist: boolean;
  onShowChecklist: () => void;
  onScrollToIdentity: () => void;
  primary?: boolean;
  attributionSaveUrl?: string;
};

const QUOTE_READY_SCROLL_CTA = "Save details to unlock upload";

function UploadPlaceholder({ pendingSave = false }: { pendingSave?: boolean }) {
  return (
    <div
      className="mt-6 rounded-xl border border-dashed border-slate-200/90 bg-slate-50/60 px-5 py-7 text-center"
      aria-hidden={pendingSave ? "true" : undefined}
    >
      <UploadCloud className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-slate-500">
        {pendingSave ? "Upload unlocks after you save your details" : "Upload area"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        {pendingSave
          ? "Complete Step 3 below first — then return here to upload a PDF, photo, or screenshot."
          : "PDF · photo · screenshot"}
      </p>
      {pendingSave ? (
        <span className="mt-4 inline-block rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Locked until Step 3
        </span>
      ) : null}
    </div>
  );
}

function AttributionSaveLink({ url, subdued = false }: { url: string; subdued?: boolean }) {
  return (
    <div
      className={[
        "rounded-lg border border-dashed px-4 py-3",
        subdued
          ? "mt-8 border-slate-200/70 bg-slate-50/50"
          : "mt-6 border-slate-200/80 bg-slate-50/80",
      ].join(" ")}
    >
      <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {subdued ? "Optional — need to come back later?" : "Attribution-safe return link"}
      </p>
      <p className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-slate-500">
        {url}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        Bookmark or copy this page link to return later. Not required to upload — no personal details
        are included in the URL.
      </p>
    </div>
  );
}

const SESSION_FALLBACK_COPY =
  "We could not find your saved quote-check session. Refresh and save your details again before uploading.";

export function NextdoorQuoteReadyPanel({
  identitySubmitted,
  sessionId,
  leadId,
  attributionSaveUrl,
  onScrollToIdentity,
  onScanStart,
}: {
  identitySubmitted: boolean;
  sessionId: string;
  /** Contact-owned lead id (Sprint 2A) forwarded to NextdoorQuoteUpload. */
  leadId?: string | null;
  attributionSaveUrl?: string;
  onScrollToIdentity: () => void;
  onScanStart: (fileName: string, scanSessionId: string) => void;
}) {
  // Sprint 2E-B contact-owned upload contract: the usable upload mounts only
  // when a trusted leadId + sessionId pair exists. `identitySubmitted` is a UI
  // hint only and must never be the upload authorization condition.
  const trustedIdentity = hasTrustedContactIdentity(leadId, sessionId);
  const copy = nextStepPanelCopy("has_estimate");

  return (
    <div className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-white via-white to-primary/5 p-6 shadow-[0_12px_40px_-16px_rgba(37,99,235,0.35)] md:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
          {copy.badge}
        </span>
        {trustedIdentity ? (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            Upload next
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <UploadCloud className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900 md:text-2xl">
            {copy.headline}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 md:text-base">{copy.body}</p>
          {!trustedIdentity ? (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              You&apos;ll see a safe preview first. Full details unlock after a quick phone check.
            </p>
          ) : null}
        </div>
      </div>

      {trustedIdentity ? (
        <div id="quote-ready-upload" className="scroll-mt-28">
          <NextdoorQuoteUpload
            sessionId={sessionId}
            isVisible
            leadId={leadId}
            onScanStart={onScanStart}
          />
        </div>
      ) : (
        <>
          <UploadPlaceholder pendingSave />
          <button
            type="button"
            onClick={onScrollToIdentity}
            className={[nextdoorSecondaryCtaClass, "mt-4 w-full sm:w-auto"].join(" ")}
            style={{ padding: "12px 24px", fontSize: 14 }}
          >
            {QUOTE_READY_SCROLL_CTA}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            {identitySubmitted
              ? SESSION_FALLBACK_COPY
              : "Takes you to the details step — nothing is saved yet."}
          </p>
        </>
      )}

      {attributionSaveUrl ? (
        <AttributionSaveLink url={attributionSaveUrl} subdued={trustedIdentity} />
      ) : null}
    </div>
  );
}

export function NextdoorPrepPanel({
  readiness,
  showChecklist,
  onShowChecklist,
  onScrollToIdentity,
  primary = false,
  attributionSaveUrl,
}: PrepPanelProps) {
  const copy = nextStepPanelCopy(readiness);
  const items = checklistItems(readiness);

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
        {primary || readiness === "researching" ? (
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

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onScrollToIdentity}
          className={[nextdoorPrimaryCtaClass, "w-full sm:w-auto"].join(" ")}
          style={{ padding: "14px 28px", fontSize: 15 }}
        >
          {copy.saveCta}
        </button>
        {!showChecklist ? (
          <button
            type="button"
            onClick={onShowChecklist}
            className="w-full rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-[0_4px_12px_-6px_rgba(15,23,42,0.2)] transition-all hover:border-primary/40 hover:shadow-md sm:w-auto"
          >
            {readiness === "researching" ? "Show quote anatomy" : "Show checklist"}
          </button>
        ) : null}
      </div>

      {showChecklist ? (
        <>
          <ul className="mt-6 space-y-2.5">
            {items.map((item) => (
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
      ) : null}
    </div>
  );
}
