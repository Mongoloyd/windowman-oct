/**
 * AnalysisSummaryModal — Sprint 2.5 Quote Preview (local prototype).
 *
 * Prop-driven safe preview only. No live contractor handoff, persistence,
 * or full Truth Report authorization.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuotePreviewImportance, QuotePreviewViewModel } from "./scanPrototypeModel";

type AnalysisSummaryModalProps = {
  open: boolean;
  preview: QuotePreviewViewModel;
  onClose: () => void;
  onRunAnother: () => void;
};

const CONTRACTOR_LOCAL_RESPONSE =
  "Contractor-network preparation will be connected in a later sprint.";

const PROOF_NOT_FOUND = "Not found in the estimate";

function proofDisplay(value: string | null): string {
  return value?.trim() ? value.trim() : PROOF_NOT_FOUND;
}

function priorityLabel(importance: QuotePreviewImportance): string {
  switch (importance) {
    case "high":
      return "HIGH PRIORITY";
    case "medium":
      return "MEDIUM PRIORITY";
    case "low":
      return "LOW PRIORITY";
    default:
      return "PRIORITY";
  }
}

function priorityBadgeClasses(importance: QuotePreviewImportance): string {
  switch (importance) {
    case "high":
      return "bg-amber-100 text-amber-950 border-amber-300";
    case "medium":
      return "bg-blue-100 text-[#1264D8] border-blue-200";
    case "low":
      return "bg-slate-100 text-slate-700 border-slate-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-300";
  }
}

function formatCountMetric(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export default function AnalysisSummaryModal({
  open,
  preview,
  onClose,
  onRunAnother,
}: AnalysisSummaryModalProps) {
  const [contractorFeedback, setContractorFeedback] = useState<string | null>(null);
  const findings = preview.findings.slice(0, 3);
  const isDemo = preview.source === "demo";
  const isLivePreview = preview.source === "live_preview";

  const summaryMetrics: string[] = [];
  if (preview.warningCount !== null) {
    summaryMetrics.push(formatCountMetric(preview.warningCount, "warning", "warnings"));
  }
  if (preview.missingDetailCount !== null) {
    summaryMetrics.push(
      formatCountMetric(preview.missingDetailCount, "missing detail", "missing details"),
    );
  }
  if (preview.gradeBand !== null) {
    summaryMetrics.push(preview.gradeBand);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setContractorFeedback(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl gap-0 border-slate-200 bg-white p-0 sm:rounded-2xl">
        {isDemo ? (
          <div
            role="status"
            className="border-b border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 sm:px-6"
          >
            <p className="text-xs font-black uppercase tracking-wide sm:text-sm">
              DEMO PREVIEW — SAMPLE DATA, NOT GENERATED FROM YOUR FILE
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90 sm:text-sm">
              Preview interface demonstration — full Truth Report remains locked.
            </p>
          </div>
        ) : null}

        {isLivePreview ? (
          <div
            role="status"
            className="border-b border-[#0B2545]/20 bg-[#0B2545] px-4 py-3 text-white sm:px-6"
          >
            <p className="text-xs font-black uppercase tracking-wide sm:text-sm">
              REAL SCAN PREVIEW — FULL TRUTH REPORT REMAINS LOCKED
            </p>
          </div>
        ) : null}

        <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6">
          <DialogHeader className="space-y-3 text-left">
            <span className="inline-flex w-fit rounded-md bg-[#0B2545] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
              WINDOWMAN QUOTE PREVIEW
            </span>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-[#0B2545] sm:text-2xl">
              HERE&apos;S WHERE THE QUOTE NEEDS PRESSURE.
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-600 sm:text-base">
              {isDemo
                ? "Sample preview findings show how WindowMan surfaces pressure points before the full Truth Report unlocks."
                : "Preview findings highlight where your estimate deserves clarification before the full Truth Report unlocks."}
            </DialogDescription>
          </DialogHeader>

          <section aria-labelledby="preview-proof-heading">
            <h3
              id="preview-proof-heading"
              className="text-sm font-bold uppercase tracking-wide text-[#0B2545]"
            >
              {isDemo ? "DEMO PROOF OF READ" : "WINDOWMAN FOUND"}
            </h3>
            <dl className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/80">
              <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[7rem_1fr] sm:gap-3 sm:px-4">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Contractor
                </dt>
                <dd className="text-sm font-medium text-[#0B2545] break-words">
                  {proofDisplay(preview.contractorName)}
                </dd>
              </div>
              <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[7rem_1fr] sm:gap-3 sm:px-4">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Document type
                </dt>
                <dd className="text-sm font-medium text-[#0B2545] break-words">
                  {proofDisplay(preview.documentType)}
                </dd>
              </div>
              <div className="grid gap-1 px-3 py-2.5 sm:grid-cols-[7rem_1fr] sm:gap-3 sm:px-4">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Opening scope
                </dt>
                <dd className="text-sm font-medium text-[#0B2545] break-words">
                  {proofDisplay(preview.openingCountBucket)}
                </dd>
              </div>
            </dl>
          </section>

          {summaryMetrics.length > 0 ? (
            <section aria-labelledby="preview-metrics-heading">
              <h3
                id="preview-metrics-heading"
                className="text-sm font-bold uppercase tracking-wide text-[#0B2545]"
              >
                Intelligence summary
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {summaryMetrics.map((metric) => (
                  <li
                    key={metric}
                    className="rounded-lg bg-[#0B2545] px-3 py-2 text-sm font-bold text-white"
                  >
                    {metric}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="preview-findings-heading">
            <h3
              id="preview-findings-heading"
              className="text-sm font-bold uppercase tracking-wide text-[#0B2545]"
            >
              Top findings
            </h3>

            {findings.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                No preview findings are available yet.
              </p>
            ) : (
              <ol className="mt-3 space-y-4">
                {findings.map((finding, index) => (
                  <li
                    key={finding.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${priorityBadgeClasses(finding.importance)}`}
                      >
                        {priorityLabel(finding.importance)}
                      </span>
                      <span className="sr-only">{`Finding ${index + 1} of ${findings.length}.`}</span>
                    </div>
                    <p className="mt-2 text-base font-bold leading-snug text-[#0B2545] break-words">
                      {finding.title}
                    </p>
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Evidence
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700 break-words">
                        {finding.evidence}
                      </p>
                    </div>
                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Why it matters
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700 break-words">
                        {finding.whyItMatters}
                      </p>
                    </div>
                    <div className="mt-3 rounded-lg border border-[#1878F0]/30 bg-blue-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#1264D8]">
                        What to ask
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-[#0B2545] break-words">
                        {finding.recommendedAction}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="space-y-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setContractorFeedback(CONTRACTOR_LOCAL_RESPONSE)}
              className="
                inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-6
                bg-gradient-to-r from-[#1878F0] to-[#1264D8]
                text-sm font-black tracking-[-0.01em] text-white sm:text-base
                border-t border-white/35 border-b-4 border-b-[#0B2545]
                shadow-[0_12px_28px_-10px_rgba(24,120,240,0.65)]
                transition-[transform,box-shadow,filter] duration-150
                hover:-translate-y-0.5 hover:brightness-105
                active:translate-y-1 active:border-b-0
                focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300
                motion-reduce:transition-none motion-reduce:hover:translate-y-0
              "
            >
              PREPARE MY QUOTE FOR COMPETITION
            </button>

            {contractorFeedback ? (
              <p role="status" aria-live="polite" className="text-center text-sm text-slate-600">
                {contractorFeedback}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setContractorFeedback(null);
                  onClose();
                }}
                aria-label="Close preview"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold uppercase tracking-wide text-[#0B2545] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
              >
                CLOSE PREVIEW
              </button>
              <button
                type="button"
                onClick={() => {
                  setContractorFeedback(null);
                  onRunAnother();
                }}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#1878F0]/40 bg-blue-50 px-4 text-sm font-bold uppercase tracking-wide text-[#1264D8] transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
              >
                RUN ANOTHER ESTIMATE
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
