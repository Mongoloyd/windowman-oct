import { Clock3, Upload } from "lucide-react";
import { POST_CAPTURE_ROUTER_COPY } from "@/components/postcapture/postCaptureCopy";
import type { PostCapturePath } from "@/components/PostCaptureRouter";

/**
 * Sprint 2F-E upload-later / save-my-spot panel.
 *
 * Frontend-only: shown when a homeowner has a quote but not on this device. It
 * reassures them that their quote check is already started and offers a calm
 * pivot back to upload. It never mounts UploadZone, never calls
 * start-upload-scan-session / scan-quote / capture-truth-gate-lead, never writes
 * to Supabase, and never tracks. The primary CTA pivots to the upload path via
 * onUploadNow, reusing the existing contact-owned leadId/sessionId held by
 * Index.tsx.
 */
export interface UploadLaterPanelProps {
  onUploadNow: () => void;
  onSelectPath: (path: PostCapturePath) => void;
}

const C = POST_CAPTURE_ROUTER_COPY;

const primaryCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-body text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90";
const linkBtnClass =
  "font-body text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

export default function UploadLaterPanel({
  onUploadNow,
  onSelectPath,
}: UploadLaterPanelProps) {
  return (
    <div
      data-testid="post-capture-upload-later"
      className="mx-auto mt-6 max-w-2xl rounded-2xl border border-border/60 bg-card/80 px-6 py-8 text-center shadow-sm"
      role="status"
    >
      <span
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Clock3 className="h-6 w-6" />
      </span>
      <h2 className="mt-4 font-display text-2xl font-extrabold tracking-[0.01em] text-foreground sm:text-3xl">
        {C.uploadLater.headline}
      </h2>
      <p className="mx-auto mt-3 max-w-xl font-body text-sm leading-relaxed text-muted-foreground">
        {C.uploadLater.supporting}
      </p>
      <p className="mx-auto mt-2 max-w-xl font-body text-sm leading-relaxed text-muted-foreground">
        {C.uploadLater.secondarySupporting}
      </p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button type="button" onClick={onUploadNow} className={primaryCtaClass}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {C.uploadLater.pivotCta}
        </button>
        <p className="font-body text-xs text-muted-foreground">
          {C.uploadLater.helpText}
        </p>
        <button
          type="button"
          onClick={() => onSelectPath("router")}
          className={linkBtnClass}
        >
          {C.backToOptions}
        </button>
      </div>
    </div>
  );
}
