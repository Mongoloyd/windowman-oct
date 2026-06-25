/**
 * ═══════════════════════════════════════════════════════════════════════════
 * QUOTE VIEWER MODAL — Secure 1-click quote/estimate preview
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Operator-facing modal that opens the homeowner's uploaded quote/estimate.
 *
 * SECURITY MODEL (do not weaken):
 *   • The browser NEVER generates signed URLs, never touches storage.from(...),
 *     and never guesses bucket paths.
 *   • Quote access flows exclusively through the role-gated admin-data action
 *     `fetch_quote_evidence` (super_admin / operator / viewer), which resolves
 *     the lead's latest quote_file by lead_id and signs a short-lived URL with
 *     the service-role key server-side against the private `quotes` bucket.
 *   • The signed URL is consumed in-memory only — never logged, never persisted
 *     to localStorage/sessionStorage.
 *
 * The fetch is lazy: it only fires while the modal is open.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, FileSearch, FileText, ImageOff, RefreshCcw, AlertTriangle } from "lucide-react";
import { fetchQuoteEvidence } from "@/services/adminDataService";
import type { QuoteEvidence } from "@/components/admin/types";

interface QuoteViewerModalProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Heuristic: signed URLs point at the private storage object path. */
function looksLikePdf(url: string): boolean {
  return /\.pdf(?:\?|$)/i.test(url);
}

export function QuoteViewerModal({ leadId, open, onOpenChange }: QuoteViewerModalProps) {
  const query = useQuery<QuoteEvidence>({
    queryKey: ["admin", "quote-viewer", leadId],
    queryFn: () => fetchQuoteEvidence(leadId),
    enabled: open && Boolean(leadId),
    // Signed URLs are short-lived; fetch a fresh one rather than reusing a
    // potentially expired cached link across long-lived modal sessions.
    staleTime: 60_000,
    retry: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Uploaded quote</DialogTitle>
          <DialogDescription>
            Securely retrieved from the homeowner's private quote on file.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[180px]">
          {query.isLoading ? (
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <Skeleton className="h-48 w-full" />
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
            <QuotePreview evidence={query.data} />
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
    <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 p-4 text-sm text-slate-700">
      <ImageOff className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{headline}</p>
          <p className="text-muted-foreground">{detail}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/admin/lead-evidence?lead_id=${encodeURIComponent(leadId)}`}>
            <FileSearch className="mr-1.5 h-3.5 w-3.5" />
            Open Evidence Inspector
          </Link>
        </Button>
      </div>
    </div>
  );
}

function QuotePreview({ evidence }: { evidence: QuoteEvidence }) {
  const url = evidence.signed_url as string;
  const isPdf = looksLikePdf(url);
  const expiresMin = Math.max(1, Math.round((evidence.expires_in ?? 3600) / 60));

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border border-border/60 bg-card">
        {isPdf ? (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4" />
              Quote document (PDF)
            </div>
            <Button asChild className="w-fit">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open PDF in new tab
              </a>
            </Button>
          </div>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-muted/20"
            title="Open full-size in new tab"
          >
            <img
              src={url}
              alt="Uploaded quote"
              className="max-h-[60vh] w-full bg-black/5 object-contain"
              loading="lazy"
            />
          </a>
        )}
      </div>
      <p className="text-xs font-medium text-slate-600">
        Secure signed link · expires in ~{expiresMin}m
      </p>
    </div>
  );
}
