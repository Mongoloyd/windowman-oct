import { ArrowRight, Clock3, FileCheck2, ListChecks } from "lucide-react";
import { POST_CAPTURE_ROUTER_COPY } from "@/components/postcapture/postCaptureCopy";
import NoQuoteDiagnostic from "@/components/postcapture/NoQuoteDiagnostic";
import UploadLaterPanel from "@/components/postcapture/UploadLaterPanel";

/**
 * Sprint 2F-C: the post-contact intent router is a frontend UI shell only.
 *
 * It runs AFTER a trusted contact-owned lead/session already exists and simply
 * decides which next surface to show. Only the "upload" path mounts a usable
 * UploadZone (owned by Index.tsx). The "upload_later" and "no_quote" paths are
 * placeholders that must never mount UploadZone, never call
 * start-upload-scan-session, and never create a quote_file/scan_session. The
 * pivot CTAs reuse the same leadId/sessionId via onUploadNow.
 */
export type PostCapturePath = "router" | "upload" | "upload_later" | "no_quote";

export interface PostCaptureRouterProps {
  selectedPath: PostCapturePath;
  onSelectPath: (path: PostCapturePath) => void;
  onUploadNow: () => void;
}

const C = POST_CAPTURE_ROUTER_COPY;

const cardClass =
  "group flex w-full items-start gap-3.5 rounded-2xl border border-border/60 bg-card/80 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md";
const iconWrapClass =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary";

export default function PostCaptureRouter({
  selectedPath,
  onSelectPath,
  onUploadNow,
}: PostCaptureRouterProps) {
  // The "upload" path is owned by Index.tsx (it mounts UploadZone), so the
  // router renders nothing for it.
  if (selectedPath === "upload") return null;

  if (selectedPath === "upload_later") {
    return (
      <UploadLaterPanel onUploadNow={onUploadNow} onSelectPath={onSelectPath} />
    );
  }

  if (selectedPath === "no_quote") {
    return (
      <NoQuoteDiagnostic onUploadNow={onUploadNow} onSelectPath={onSelectPath} />
    );
  }

  return (
    <div
      data-testid="post-capture-router"
      className="mx-auto mt-6 max-w-2xl px-1"
      aria-label="Choose your next step"
    >
      <div className="text-center">
        <h2 className="font-display text-2xl font-extrabold tracking-[0.01em] text-foreground sm:text-3xl">
          {C.headline}
        </h2>
        <p className="mx-auto mt-2 max-w-xl font-body text-sm leading-relaxed text-muted-foreground">
          {C.supporting}
        </p>
      </div>

      <div className="mt-6 grid gap-3.5">
        <button
          type="button"
          onClick={onUploadNow}
          className={cardClass}
          aria-label={C.cards.upload.cta}
        >
          <span className={iconWrapClass} aria-hidden="true">
            <FileCheck2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold leading-snug text-foreground md:text-lg">
              {C.cards.upload.title}
            </span>
            <span className="mt-1.5 block font-body text-sm leading-relaxed text-muted-foreground">
              {C.cards.upload.subcopy}
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-primary">
              {C.cards.upload.cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectPath("upload_later")}
          className={cardClass}
          aria-label={C.cards.upload_later.cta}
        >
          <span className={iconWrapClass} aria-hidden="true">
            <Clock3 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold leading-snug text-foreground md:text-lg">
              {C.cards.upload_later.title}
            </span>
            <span className="mt-1.5 block font-body text-sm leading-relaxed text-muted-foreground">
              {C.cards.upload_later.subcopy}
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-primary">
              {C.cards.upload_later.cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectPath("no_quote")}
          className={cardClass}
          aria-label={C.cards.no_quote.cta}
        >
          <span className={iconWrapClass} aria-hidden="true">
            <ListChecks className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-bold leading-snug text-foreground md:text-lg">
              {C.cards.no_quote.title}
            </span>
            <span className="mt-1.5 block font-body text-sm leading-relaxed text-muted-foreground">
              {C.cards.no_quote.subcopy}
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 font-body text-sm font-semibold text-primary">
              {C.cards.no_quote.cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
