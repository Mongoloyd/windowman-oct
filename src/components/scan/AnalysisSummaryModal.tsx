/**
 * AnalysisSummaryModal — Sprint 2 example Truth Report (local prototype).
 *
 * Unmistakably labeled as an example. No live contractor handoff, match,
 * posting, or price-beat claims.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AnalysisSummaryModalProps = {
  open: boolean;
  onClose: () => void;
  onRunAnother: () => void;
};

const REVIEW_ITEMS = [
  "Warranty labor coverage is unclear",
  "Permit responsibility should be confirmed",
  "Exact glass specifications are incomplete",
  "Removal, disposal, and finishing scope need clarification",
] as const;

const EXAMPLE_QUESTIONS = [
  "Who is responsible for permit fees and inspections?",
  "Does the warranty include labor and service calls?",
  "What exact glass package and certifications are included?",
  "Are removal, disposal, patching, and finishing included?",
] as const;

const CONTRACTOR_LOCAL_RESPONSE =
  "The live contractor-network handoff will be connected in a later sprint.";

export default function AnalysisSummaryModal({
  open,
  onClose,
  onRunAnother,
}: AnalysisSummaryModalProps) {
  const [contractorFeedback, setContractorFeedback] = useState<string | null>(null);

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
      <DialogContent className="max-w-2xl border-slate-200 bg-white sm:rounded-2xl">
        <DialogHeader className="space-y-3 text-left">
          <span className="inline-flex w-fit rounded-md bg-[#0B2545] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
            EXAMPLE TRUTH REPORT
          </span>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-[#0B2545] sm:text-2xl">
            HERE&apos;S WHERE THE QUOTE NEEDS PRESSURE.
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate-600 sm:text-base">
            This example estimate includes window and door replacement work, but several price,
            scope, glass, and warranty details deserve clarification before signing.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#0B2545] px-4 py-3 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200">
              ESTIMATED OPENINGS
            </p>
            <p className="mt-1 text-2xl font-black">10</p>
          </div>
          <div className="rounded-xl bg-[#0B2545] px-4 py-3 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200">
              QUOTED TOTAL
            </p>
            <p className="mt-1 text-2xl font-black">$28,750</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#0B2545]">
            Example review items
          </h3>
          <ul className="mt-2 space-y-2">
            {REVIEW_ITEMS.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-sm leading-relaxed text-slate-700"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1878F0]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#0B2545]">
            Example questions
          </h3>
          <ul className="mt-2 space-y-2">
            {EXAMPLE_QUESTIONS.map((question) => (
              <li key={question} className="text-sm leading-relaxed text-slate-700">
                <span className="font-semibold text-[#1878F0]">Q. </span>
                {question}
              </li>
            ))}
          </ul>
        </div>

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
            MAKE CONTRACTORS COMPETE
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
              aria-label="Close report"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold uppercase tracking-wide text-[#0B2545] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
            >
              CLOSE REPORT
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
      </DialogContent>
    </Dialog>
  );
}
