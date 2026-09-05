/**
 * QUOTE VIEWER MODAL — Secure 1-click quote/estimate preview
 *
 * SECURITY MODEL (do not weaken):
 *   • The browser NEVER generates signed URLs, never touches storage.from(...),
 *     and never guesses bucket paths.
 *   • Quote access flows exclusively through the role-gated admin-data action
 *     `fetch_quote_evidence`, which signs a short-lived URL server-side.
 *   • The signed URL is consumed in-memory only — never logged, never persisted.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink, FileSearch, FileText, ImageOff, RefreshCcw, AlertTriangle,
  ZoomIn, ZoomOut, RotateCw, Maximize2, X,
} from "lucide-react";
import { fetchQuoteEvidence } from "@/services/adminDataService";
import type { QuoteEvidence } from "@/components/admin/types";
import { useQuery } from "@tanstack/react-query";

interface QuoteViewerModalProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

function looksLikePdf(url: string, fileName: string | null): boolean {
  return /\.pdf(?:\?|$)/i.test(url) || /\.pdf$/i.test(fileName ?? "");
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function QuoteViewerModal({ leadId, open, onOpenChange }: QuoteViewerModalProps) {
  const query = useQuery<QuoteEvidence>({
    queryKey: ["admin", "quote-viewer", leadId],
    queryFn: () => fetchQuoteEvidence(leadId),
    enabled: open && Boolean(leadId),
    staleTime: 60_000,
    retry: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl"
        data-testid="quote-viewer-modal"
      >
        <DialogHeader>
          <DialogTitle>Uploaded quote</DialogTitle>
          <DialogDescription>
            Securely retrieved from the homeowner's private quote on file.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[180px]">
          {query.isLoading ? (
            <div
              className="rounded-md border border-border/60 bg-muted/30 p-3"
              data-testid="quote-viewer-loading"
            >
              <Skeleton className="h-48 w-full" />
              <p className="sr-only">Loading quote preview</p>
            </div>
          ) : query.isError ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-red-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-2">
                  <p className="font-semibold">Quote temporarily unavailable. Try again.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => query.refetch()}
                    disabled={query.isFetching}
                  >
                    <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ) : !query.data?.signed_url ? (
            <QuoteMissingState leadId={leadId} evidence={query.data} />
          ) : (
            <QuotePreview
              evidence={query.data}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuoteMissingState({ leadId, evidence }: { leadId: string; evidence: QuoteEvidence | undefined }) {
  const hasScanSession = Boolean(evidence?.scan_session_id);
  const headline = hasScanSession
    ? "Quote preview unavailable for this lead."
    : "No quote uploaded for this lead yet.";
  const detail = hasScanSession
    ? "A scan session is linked to this lead, but no quote file is attached here or the secure preview could not be opened. Use Evidence Inspector to review linked quote and scan records."
    : "This usually means the contact was captured before a quote upload, or the upload belongs to another lead/session. Use Evidence Inspector to review linked scan and quote records.";

  return (
    <div
      className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 p-4 text-sm text-slate-700"
      data-testid="quote-viewer-empty"
    >
      <ImageOff className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{headline}</p>
          <p className="text-muted-foreground">{detail}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="min-h-11">
          <Link to={`/admin/lead-evidence?lead_id=${encodeURIComponent(leadId)}`}>
            <FileSearch className="mr-1.5 h-3.5 w-3.5" />
            Open Evidence Inspector
          </Link>
        </Button>
      </div>
    </div>
  );
}

function QuotePreview({
  evidence,
  onClose,
}: {
  evidence: QuoteEvidence;
  onClose: () => void;
}) {
  const url = evidence.signed_url as string;
  const isPdf = looksLikePdf(url, evidence.file_name);
  const expiresMin = Math.max(1, Math.round((evidence.expires_in ?? 3600) / 60));
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const reduceMotion = prefersReducedMotion();

  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [url]);

  const fitToWindow = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!isPdf ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={fitToWindow}
              aria-label="Fit quote to window"
            >
              <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
              Fit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setZoom((value) => Math.max(MIN_ZOOM, Number((value - ZOOM_STEP).toFixed(2))))}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out quote"
            >
              <ZoomOut className="mr-1.5 h-3.5 w-3.5" />
              Zoom out
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setZoom((value) => Math.min(MAX_ZOOM, Number((value + ZOOM_STEP).toFixed(2))))}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in quote"
            >
              <ZoomIn className="mr-1.5 h-3.5 w-3.5" />
              Zoom in
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setRotation((value) => (value + 90) % 360)}
              aria-label="Rotate quote"
            >
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              Rotate
            </Button>
          </>
        ) : null}
        <Button asChild variant="outline" size="sm" className="min-h-11">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {isPdf ? "Open PDF in new tab" : "Open in new tab"}
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={onClose}
          aria-label="Close quote viewer"
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Close
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border/60 bg-card">
        {isPdf ? (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4" />
              Quote document (PDF)
            </div>
            {evidence.file_name ? (
              <p className="text-sm font-medium text-slate-600">{evidence.file_name}</p>
            ) : null}
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto bg-muted/20">
            <img
              src={url}
              alt="Uploaded quote"
              data-testid="quote-viewer-image"
              data-zoom={zoom}
              data-rotation={rotation}
              className="mx-auto max-w-full bg-black/5 object-contain"
              style={{
                maxHeight: "60vh",
                transform: `rotate(${rotation}deg) scale(${zoom})`,
                transformOrigin: "center center",
                transition: reduceMotion ? "none" : "transform 150ms ease",
              }}
              loading="lazy"
            />
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-slate-600">
        Secure signed link · expires in ~{expiresMin}m
        {!isPdf ? ` · ${Math.round(zoom * 100)}% · ${rotation}°` : ""}
      </p>
    </div>
  );
}
