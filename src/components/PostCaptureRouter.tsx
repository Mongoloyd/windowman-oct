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
  "group relative flex w-full items-start gap-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/60 to-white p-5 text-left shadow-[0_24px_60px_-32px_rgba(15,76,129,0.28),0_10px_24px_-18px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_32px_80px_-36px_rgba(37,99,235,0.42),0_16px_32px_-22px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 active:scale-[0.99] sm:p-6";
const iconWrapClass =
  "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-200/80 bg-gradient-to-br from-white via-sky-50 to-blue-100 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_26px_-18px_rgba(37,99,235,0.55)] transition-all duration-300 group-hover:scale-105 group-hover:text-blue-700 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_16px_30px_-16px_rgba(37,99,235,0.7)]";

type RouterCardKey = "upload" | "upload_later" | "no_quote";

const CARD_ICONS: Record<RouterCardKey, typeof FileCheck2> = {
  upload: FileCheck2,
  upload_later: Clock3,
  no_quote: ListChecks,
};

function RouterOptionCard({
  cardKey,
  onClick,
  ariaLabel,
}: {
  cardKey: RouterCardKey;
  onClick: () => void;
  ariaLabel: string;
}) {
  const card = C.cards[cardKey];
  const Icon = CARD_ICONS[cardKey];

  return (
    <button type="button" onClick={onClick} className={cardClass} aria-label={ariaLabel}>
      <span
        className="pointer-events-none absolute inset-y-4 right-0 w-1 rounded-l-full bg-gradient-to-b from-sky-300 via-blue-500 to-sky-300 opacity-0 blur-[1px] transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden="true"
      />
      <span className={iconWrapClass} aria-hidden="true">
        <Icon className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="block font-display text-base font-bold leading-snug text-foreground md:text-lg">
            {card.title}
          </span>
          {card.badge ? (
            <span className="inline-flex rounded-full border border-blue-200/70 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              {card.badge}
            </span>
          ) : null}
        </span>
        <span className="mt-1.5 block font-body text-sm leading-relaxed text-muted-foreground">
          {card.subcopy}
        </span>
        <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-blue-200/70 bg-blue-50 px-3.5 py-1.5 font-body text-sm font-semibold text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_-12px_rgba(37,99,235,0.5)] transition-colors duration-300 group-hover:bg-blue-100">
          {card.cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

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
      id="post-capture-router-anchor"
      data-testid="post-capture-router"
      className="scroll-mt-24 relative mx-auto mt-6 max-w-2xl px-1"
      aria-label="Choose your next step"
    >
      <div
        className="pointer-events-none absolute inset-x-0 -top-6 mx-auto h-80 max-w-xl rounded-[3rem] bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.18),transparent_62%)] blur-3xl"
        aria-hidden="true"
      />

      <div className="relative rounded-[2rem] border border-blue-200/50 bg-white/45 p-4 shadow-[0_30px_90px_-55px_rgba(15,76,129,0.4)] backdrop-blur-sm sm:p-6">
        <div className="text-center">
          <h2 className="font-display text-2xl font-extrabold tracking-[0.01em] text-foreground sm:text-3xl">
            {C.headline}
          </h2>
          <p className="mx-auto mt-2 max-w-xl font-body text-sm leading-relaxed text-muted-foreground">
            {C.supporting}
          </p>
        </div>

        <div className="mt-6 grid gap-3.5">
          <RouterOptionCard
            cardKey="upload"
            onClick={onUploadNow}
            ariaLabel={C.cards.upload.cta}
          />
          <RouterOptionCard
            cardKey="upload_later"
            onClick={() => onSelectPath("upload_later")}
            ariaLabel={C.cards.upload_later.cta}
          />
          <RouterOptionCard
            cardKey="no_quote"
            onClick={() => onSelectPath("no_quote")}
            ariaLabel={C.cards.no_quote.cta}
          />
        </div>

        <p className="mx-auto mt-5 max-w-md text-center font-body text-xs leading-relaxed text-muted-foreground">
          {C.trustLine}
        </p>
      </div>
    </div>
  );
}
