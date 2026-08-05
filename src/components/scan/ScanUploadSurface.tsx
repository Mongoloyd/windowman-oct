/**
 * ScanUploadSurface — Sprint 2 Quote Competition Stage.
 *
 * Local file selection + validation only. Never reads file contents, creates
 * object URLs, Base64-encodes, uploads, or calls Supabase/Gemini/tracking.
 *
 * NOTE: The local 15 MiB prototype limit must be reconciled with backend
 * enforcement before production wiring.
 */

import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { FileText, UploadCloud } from "lucide-react";
import {
  ACCEPTED_FILE_TYPES,
  CHECK_DIMENSIONS,
  formatFileSize,
  MAX_PROTOTYPE_BYTES,
  type SelectedEstimateMeta,
} from "./scanPrototypeModel";

export const SCAN_UPLOAD_SECTION_ID = "scan-upload";
export const SCAN_UPLOAD_INPUT_ID = "scan-upload-input";

type ScanUploadSurfaceProps = {
  selected: SelectedEstimateMeta | null;
  error: string | null;
  multiFileNotice: string | null;
  reviewDisabled?: boolean;
  selectedFootnote?: string;
  onFilesChosen: (files: File[] | FileList | null) => void;
  onRemove: () => void;
  onReview: () => void;
  onRetryScan?: () => void;
  onStartOver?: () => void;
};

function ExampleReportPreview() {
  return (
    <aside
      aria-label="Example Truth Report preview"
      className="relative w-full max-w-[220px] shrink-0 rotate-[-2deg] rounded-xl bg-[#0B2545] p-4 text-white shadow-[0_18px_40px_-24px_rgba(11,37,69,0.85)] sm:max-w-[240px]"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-200">
        EXAMPLE TRUTH REPORT
      </p>
      <dl className="mt-3 space-y-2.5 text-xs leading-snug">
        <div>
          <dt className="font-semibold text-white/90">Warranty labor:</dt>
          <dd className="text-blue-100">Needs clarification</dd>
        </div>
        <div>
          <dt className="font-semibold text-white/90">Permit responsibility:</dt>
          <dd className="text-blue-100">Not clearly stated</dd>
        </div>
        <div>
          <dt className="font-semibold text-white/90">Glass package:</dt>
          <dd className="text-blue-100">Confirm exact specification</dd>
        </div>
      </dl>
    </aside>
  );
}

function VisualPath() {
  return (
    <div
      className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 sm:gap-3"
      aria-hidden="true"
    >
      <span className="rounded-md bg-slate-100 px-2 py-1 text-[#0B2545]">QUOTE</span>
      <svg width="28" height="10" viewBox="0 0 28 10" className="text-[#1878F0]">
        <path d="M0 5h22M18 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="rounded-md bg-blue-50 px-2 py-1 text-[#1264D8]">WINDOWMAN REVIEW</span>
      <svg width="28" height="10" viewBox="0 0 28 10" className="text-[#1878F0]">
        <path d="M0 5h22M18 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className="rounded-md bg-slate-100 px-2 py-1 text-[#0B2545]">COMPETITION-READY SCOPE</span>
    </div>
  );
}

const ScanUploadSurface = forwardRef<HTMLInputElement, ScanUploadSurfaceProps>(
  function ScanUploadSurface(
    {
      selected,
      error,
      multiFileNotice,
      reviewDisabled = false,
      selectedFootnote = "Selected on this device.",
      onFilesChosen,
      onRemove,
      onReview,
      onRetryScan,
      onStartOver,
    },
    ref,
  ) {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const attachInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    function openPicker() {
      inputRef.current?.click();
    }

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
      // Snapshot before clearing — FileList is live and empties when value is reset.
      const files = event.target.files ? Array.from(event.target.files) : [];
      // Clear so the same file can be reselected (change only fires on value change).
      event.target.value = "";
      onFilesChosen(files);
    }

    function handleDrop(event: DragEvent<HTMLDivElement>) {
      event.preventDefault();
      setIsDraggingOver(false);
      const files = event.dataTransfer?.files
        ? Array.from(event.dataTransfer.files)
        : [];
      onFilesChosen(files);
    }

    function handleZoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    }

    return (
      <div id={SCAN_UPLOAD_SECTION_ID} className="w-full scroll-mt-4">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px]">
          PRIVATE ESTIMATE REVIEW • FREE TO START • NO OBLIGATION
        </p>

        <div className="mt-3 flex flex-col items-center gap-4 sm:mt-3 lg:flex-row lg:items-stretch lg:gap-5">
          <div
            data-testid="scan-upload-dropzone"
            className={`
              relative w-full flex-1 rounded-[28px]
              border-2 border-dashed
              bg-[linear-gradient(180deg,rgba(239,246,255,0.96),#ffffff)]
              px-5 py-6 sm:px-8 sm:py-10
              shadow-[inset_0_2px_12px_rgba(24,120,240,0.07),0_24px_60px_-34px_rgba(11,37,69,0.55)]
              transition-[border-color,transform,box-shadow,background-color] duration-200
              motion-reduce:transition-none
              focus-within:border-[#1878F0] focus-within:ring-4 focus-within:ring-blue-300
              ${
                isDraggingOver
                  ? "border-[#1878F0] bg-blue-50/80"
                  : "border-blue-300 hover:-translate-y-0.5 hover:border-[#1878F0] motion-reduce:hover:translate-y-0"
              }
            `}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
          >
            <input
              id={SCAN_UPLOAD_INPUT_ID}
              ref={attachInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Drop your estimate here"
              aria-describedby="scan-upload-formats"
            />

            {/* Explicit trigger — not an invisible full-surface input over buttons */}
            <div
              role="button"
              tabIndex={0}
              aria-controls={SCAN_UPLOAD_INPUT_ID}
              onClick={openPicker}
              onKeyDown={handleZoneKeyDown}
              className="flex cursor-pointer flex-col items-center text-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
            >
              <UploadCloud className="h-10 w-10 text-[#1878F0]" aria-hidden="true" />
              <h2
                id="scan-upload-heading"
                className="mt-3 text-xl font-black uppercase tracking-tight text-[#0B2545] sm:text-2xl"
              >
                DROP YOUR ESTIMATE HERE
              </h2>
              <p id="scan-upload-formats" className="mt-2 text-sm text-slate-500">
                PDF, JPG, PNG, or WebP — up to {Math.round(MAX_PROTOTYPE_BYTES / (1024 * 1024))} MiB
              </p>
            </div>

            <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {CHECK_DIMENSIONS.map((item) => (
                <li
                  key={item}
                  className="rounded-md border border-blue-100 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#1264D8]"
                >
                  {item}
                </li>
              ))}
            </ul>

            <div aria-live="polite" className="mt-4 min-h-[1.25rem] text-center">
              {multiFileNotice ? (
                <p className="text-sm text-slate-600">{multiFileNotice}</p>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {error}
                </p>
              ) : null}
            </div>

            {selected ? (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 text-left">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#1878F0]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-all text-sm font-semibold text-[#0B2545]">
                      {selected.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatFileSize(selected.size)} · {selectedFootnote}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openPicker}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-bold text-[#0B2545] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                  >
                    Change file
                  </button>
                  <button
                    type="button"
                    onClick={onRemove}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-transparent px-4 text-sm font-bold text-slate-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                  >
                    Remove file
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onReview}
                  disabled={reviewDisabled}
                  className="
                    mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-6
                    bg-gradient-to-r from-[#1878F0] to-[#1264D8]
                    text-sm font-black tracking-[-0.01em] text-white
                    border-t border-white/35 border-b-4 border-b-[#0B2545]
                    shadow-[0_12px_28px_-10px_rgba(24,120,240,0.65)]
                    transition-[transform,box-shadow,filter] duration-150
                    hover:-translate-y-0.5 hover:brightness-105
                    active:translate-y-1 active:border-b-0
                    focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300
                    disabled:pointer-events-none disabled:opacity-60
                    motion-reduce:transition-none motion-reduce:hover:translate-y-0
                  "
                >
                  REVIEW THIS ESTIMATE FREE
                </button>
                {onRetryScan ? (
                  <button
                    type="button"
                    onClick={onRetryScan}
                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#1878F0]/40 bg-blue-50 px-4 text-sm font-bold uppercase tracking-wide text-[#1264D8] hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                  >
                    Retry scan
                  </button>
                ) : null}
                {onStartOver ? (
                  <button
                    type="button"
                    onClick={onStartOver}
                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold uppercase tracking-wide text-[#0B2545] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                  >
                    Start over
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="hidden w-full justify-center sm:flex lg:w-auto lg:justify-start">
            <ExampleReportPreview />
          </div>
        </div>

        {/* Compact mobile preview — keeps the mechanism visible without pushing upload off-fold */}
        <aside
          aria-label="Example Truth Report preview"
          className="mt-4 rounded-xl bg-[#0B2545] p-3 text-white sm:hidden"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-200">
            EXAMPLE TRUTH REPORT
          </p>
          <p className="mt-1.5 text-xs leading-snug text-blue-100">
            Warranty labor needs clarification · Permit responsibility not clearly stated · Glass
            package needs exact specification
          </p>
        </aside>

        <VisualPath />
      </div>
    );
  },
);

export default ScanUploadSurface;
