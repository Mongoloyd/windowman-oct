/**
 * ScanUploadSurface — Sprint 1 static upload surface for `/scan`.
 *
 * Visual + keyboard affordance only. A native file input exists so the picker
 * feels real, but the selected file is never read, validated, uploaded, logged,
 * or persisted: only `file.name` is held in local React state, and the input is
 * cleared immediately so re-picking the same file still updates the label.
 *
 * Real custody, validation, and analysis are later-sprint work.
 */

import { forwardRef, useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileText, UploadCloud } from "lucide-react";

export const SCAN_UPLOAD_SECTION_ID = "scan-upload";

const FILE_INPUT_ID = "scan-upload-input";

// HEIC/HEIF is deliberately excluded even though the `quotes` bucket allows it:
// docs/architecture/ROUTE_SCAN.md §9 scopes `/scan` to PDF, JPEG, PNG, and WebP.
const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

const ScanUploadSurface = forwardRef<HTMLInputElement>(function ScanUploadSurface(_props, ref) {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
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

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const fileName = event.target.files?.[0]?.name ?? null;
    // Clearing the value keeps custody out of the DOM and lets the same file
    // be picked twice in a row (a change event only fires when the value differs).
    event.target.value = "";
    setSelectedFileName(fileName);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    setSelectedFileName(event.dataTransfer?.files?.[0]?.name ?? null);
  }

  return (
    <section
      id={SCAN_UPLOAD_SECTION_ID}
      aria-labelledby="scan-upload-heading"
      className="bg-background scroll-mt-4"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <h2
          id="scan-upload-heading"
          className="text-center text-lg font-extrabold uppercase tracking-tight text-foreground sm:text-xl"
        >
          Upload your estimate
        </h2>

        <div className="mt-6">
          <input
            id={FILE_INPUT_ID}
            ref={attachInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
            className="peer sr-only"
          />
          <label
            htmlFor={FILE_INPUT_ID}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
            // The input is visually hidden, so mirror its focus onto the dropzone.
            // `peer-focus` (not only `peer-focus-visible`) keeps the ring visible when
            // the hero CTA moves focus here after a pointer click.
            className={`flex min-h-[168px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-white/70 px-6 py-10 text-center transition-colors peer-focus:border-primary peer-focus:ring-4 peer-focus:ring-primary/30 ${
              isDraggingOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
            }`}
          >
            <UploadCloud className="h-10 w-10 text-primary" aria-hidden="true" />
            <span className="text-base font-semibold text-foreground sm:text-lg">
              Drop your estimate here for AI review
            </span>
            <span className="text-sm text-muted-foreground">
              PDF, JPG, PNG, or WebP — up to 15 MiB
            </span>
          </label>
        </div>

        {selectedFileName && (
          <div className="mt-4 rounded-lg border border-border bg-white p-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-all text-sm font-medium text-foreground">
                  {selectedFileName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selected on this device. Nothing has been uploaded or reviewed yet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-primary underline underline-offset-2 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Change file
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

export default ScanUploadSurface;
