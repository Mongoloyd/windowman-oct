/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TRUTH STRIP DRILLDOWN — Phase 26 forensic surface
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Right-side glass sheet wired to the Mission Control Truth Strip tiles.
 *
 * For a given (stage, scope) the operator sees the exact leads that count
 * toward that tile, with three lazy-loaded inline actions per row:
 *
 *   • Evidence       → signed quote URL via fetch_quote_evidence
 *   • Logic          → analysis (grade, confidence, flags) via fetchLeadAnalysis
 *   • Jump to Dossier → hands the row up to the parent for LeadDossierSheet
 *
 * Pure presentation. No data mutation. Read-only forensic triage.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink, FileImage, FileSearch, ArrowRight,
  AlertTriangle, ImageOff, Flag, Loader2,
} from "lucide-react";
import { format } from "date-fns";

import {
  fetchStageLeads,
  fetchQuoteEvidence,
  fetchLeadAnalysis,
} from "@/services/adminDataService";
import type {
  StageLeadRow, QuoteEvidence, LeadAnalysisData, AnalysisFlag,
} from "@/components/admin/types";
import {
  STAGE_LABELS, type Scope, type StageKey,
} from "./missionControl/funnelMetrics";

interface TruthStripDrilldownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: StageKey | null;
  scope: Scope;
  /** Parent receives the row and is expected to open LeadDossierSheet. */
  onJumpToDossier: (row: StageLeadRow) => void;
}

const SCOPE_LABEL: Record<Scope, string> = {
  today: "Today",
  "7d":  "Last 7 days",
  all:   "All-time",
};

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A": return "bg-green-600 text-white";
    case "B": return "bg-emerald-500 text-white";
    case "C": return "bg-amber-500 text-white";
    case "D": return "bg-orange-600 text-white";
    case "F": return "bg-destructive text-destructive-foreground";
    default:  return "bg-muted text-slate-700";
  }
}

function fullName(row: StageLeadRow): string {
  const n = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return n || "Unnamed lead";
}

function fmtTs(s: string | null): string {
  if (!s) return "—";
  try { return format(new Date(s), "MMM d, h:mm a"); }
  catch { return s; }
}

/* ─── Evidence panel (lazy) ─────────────────────────────────────────── */
function EvidencePanel({ leadId }: { leadId: string }) {
  const q = useQuery<QuoteEvidence>({
    queryKey: ["truth-strip", "quote-evidence", leadId],
    queryFn:  () => fetchQuoteEvidence(leadId),
    staleTime: 5 * 60 * 1000,
  });

  if (q.isLoading) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/30 p-3">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-400">
        Failed to load evidence.
      </div>
    );
  }
  const ev = q.data;
  if (!ev?.signed_url) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-slate-700 flex items-start gap-2">
        <ImageOff className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-medium text-foreground">No quote on file.</div>
          {ev?.scan_session_id && (
            <div className="font-mono mt-1 text-[10px] truncate">
              session: {ev.scan_session_id}
            </div>
          )}
        </div>
      </div>
    );
  }

  const isPdf = /\.pdf(?:\?|$)/i.test(ev.signed_url);

  return (
    <div className="rounded-md border border-border/60 bg-card overflow-hidden">
      {isPdf ? (
        <a
          href={ev.signed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 p-3 text-xs hover:bg-muted/40 transition-colors"
        >
          <span className="inline-flex items-center gap-2">
            <FileImage className="h-4 w-4" />
            Open quote PDF
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-slate-700" />
        </a>
      ) : (
        <a
          href={ev.signed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-muted/20"
          title="Open full-size in new tab"
        >
          <img
            src={ev.signed_url}
            alt="Homeowner quote evidence"
            className="w-full max-h-80 object-contain bg-black/5"
            loading="lazy"
          />
        </a>
      )}
      <div className="px-3 py-1.5 border-t border-border/50 text-[10px] text-slate-700 font-mono truncate">
        signed · expires in {Math.round((ev.expires_in ?? 3600) / 60)}m
      </div>
    </div>
  );
}

/* ─── Logic panel (lazy) ─────────────────────────────────────────────── */
function LogicPanel({ analysisId }: { analysisId: string | null }) {
  const enabled = !!analysisId;
  const q = useQuery<LeadAnalysisData>({
    queryKey: ["truth-strip", "lead-analysis", analysisId],
    queryFn:  () => fetchLeadAnalysis(analysisId as string),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  if (!enabled) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-slate-700">
        No analysis attached to this lead yet.
      </div>
    );
  }
  if (q.isLoading) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-400">
        Failed to load AI analysis.
      </div>
    );
  }

  const a = q.data;
  const flags: AnalysisFlag[] = Array.isArray(a.flags) ? a.flags : [];
  const top = flags.slice(0, 5);

  return (
    <div className="rounded-md border border-border/60 bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={`text-[10px] uppercase ${gradeColor(a.grade)}`}>
          Grade {a.grade ?? "—"}
        </Badge>
        {a.confidence_score != null && (
          <Badge variant="outline" className="text-[10px] font-mono">
            confidence {Math.round((a.confidence_score as number) * 100)}%
          </Badge>
        )}
        {a.dollar_delta != null && (
          <Badge variant="outline" className="text-[10px] font-mono">
            Δ ${Number(a.dollar_delta).toLocaleString()}
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px] font-mono">
          {flags.length} flag{flags.length === 1 ? "" : "s"}
        </Badge>
      </div>
      {top.length === 0 ? (
        <p className="text-xs text-slate-700">No flags raised.</p>
      ) : (
        <ul className="space-y-1.5">
          {top.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs border-t border-border/40 pt-1.5 first:border-0 first:pt-0"
            >
              <Flag className="h-3 w-3 mt-0.5 text-slate-700 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium truncate">{f.flag}</span>
                  {f.severity && (
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {f.severity}
                    </Badge>
                  )}
                  {f.pillar && (
                    <span className="text-[10px] text-slate-700 font-mono">
                      {f.pillar}
                    </span>
                  )}
                </div>
                {f.detail && (
                  <p className="text-[11px] text-slate-700 mt-0.5 line-clamp-2">
                    {f.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
          {flags.length > top.length && (
            <li className="text-[10px] text-slate-700 pt-1">
              + {flags.length - top.length} more — open dossier for full list.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ─── Row ────────────────────────────────────────────────────────────── */
function StageRow({
  row,
  onJumpToDossier,
}: {
  row: StageLeadRow;
  onJumpToDossier: (row: StageLeadRow) => void;
}) {
  const [open, setOpen] = useState<"none" | "evidence" | "logic">("none");
  const flagCount = row.flag_count ?? 0;
  const redCount  = row.red_flag_count ?? 0;

  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm p-3 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{fullName(row)}</span>
            {row.grade && (
              <Badge className={`text-[10px] uppercase ${gradeColor(row.grade)}`}>
                {row.grade}
              </Badge>
            )}
            {redCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                {redCount} red
              </Badge>
            )}
            {flagCount > 0 && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {flagCount} flags
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-slate-700 mt-0.5 truncate">
            {(row.city || row.county) && (
              <span>{[row.city, row.county].filter(Boolean).join(" · ")}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-slate-700 uppercase tracking-wider">
            stage time
          </div>
          <div className="text-[11px] font-mono tabular-nums">
            {fmtTs(row.stage_timestamp)}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          size="sm"
          variant={open === "evidence" ? "default" : "outline"}
          className="h-7 px-2 text-[11px]"
          onClick={() => setOpen(open === "evidence" ? "none" : "evidence")}
        >
          <FileImage className="h-3 w-3 mr-1.5" />
          Evidence
        </Button>
        <Button
          size="sm"
          variant={open === "logic" ? "default" : "outline"}
          className="h-7 px-2 text-[11px]"
          onClick={() => setOpen(open === "logic" ? "none" : "logic")}
        >
          <FileSearch className="h-3 w-3 mr-1.5" />
          Logic
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px] ml-auto"
          onClick={() => onJumpToDossier(row)}
        >
          Jump to Dossier
          <ArrowRight className="h-3 w-3 ml-1.5" />
        </Button>
      </div>

      {/* Inline expansion */}
      {open === "evidence" && <EvidencePanel leadId={row.id} />}
      {open === "logic"    && <LogicPanel analysisId={row.latest_analysis_id} />}
    </div>
  );
}

/* ─── Sheet ──────────────────────────────────────────────────────────── */
export function TruthStripDrilldown({
  open,
  onOpenChange,
  stage,
  scope,
  onJumpToDossier,
}: TruthStripDrilldownProps) {
  const enabled = open && stage != null;

  const q = useQuery<{ leads: StageLeadRow[] }>({
    queryKey: ["truth-strip-drilldown", stage, scope],
    queryFn:  () => fetchStageLeads(stage as StageKey, scope, 200),
    enabled,
    staleTime: 30_000,
  });

  const rows = useMemo(() => q.data?.leads ?? [], [q.data]);
  const headerLabel = stage ? STAGE_LABELS[stage] : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[640px] lg:max-w-[820px] bg-card/95 backdrop-blur-md p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-base font-bold tracking-tight">
              {headerLabel || "Stage"} drilldown
            </SheetTitle>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {SCOPE_LABEL[scope]}
            </Badge>
          </div>
          <SheetDescription className="text-xs text-slate-700">
            {q.isLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading leads…
              </span>
            ) : q.isError ? (
              <span className="text-rose-600 dark:text-rose-400">
                Failed to load stage leads.
              </span>
            ) : (
              <span>
                {rows.length.toLocaleString()} lead{rows.length === 1 ? "" : "s"} matched ·
                forensic triage without leaving Mission Control.
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {q.isLoading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-700">
              No leads in this stage for the selected scope.
            </div>
          ) : (
            rows.map((row) => (
              <StageRow
                key={row.id}
                row={row}
                onJumpToDossier={onJumpToDossier}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
