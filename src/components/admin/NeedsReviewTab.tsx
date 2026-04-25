import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle, ImageOff, Loader2, PenLine, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatPhoneDisplay, stripNonDigits } from "@/utils/formatPhone";
import { updateLeadManualEntry } from "@/services/adminDataService";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { invokeAdminData } from "@/services/adminDataService";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface NeedsReviewLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  created_at: string;
  latest_analysis_id: string | null;
  latest_scan_session_id: string | null;
  grade: string | null;
  flag_count: number | null;
  review_reason: "no_scan" | "parse_failed" | "low_confidence";
  analysis_status: string | null;
  confidence_score: number | null;
  analysis_error: string | null;
  full_json: Record<string, unknown> | null;
  quote_image_url: string | null;
  email: string | null;
  phone_e164: string | null;
  manually_reviewed: boolean;
}

interface ManualEntryForm {
  contractorName: string;
  totalPrice: string;
  productBrand: string;
  notes: string;
}

interface NeedsReviewTabProps {
  needsReview: NeedsReviewLead[];
  isLoading: boolean;
}

/* ── Reason badge config ───────────────────────────────────────────── */

function getReasonConfig(lead: NeedsReviewLead) {
  const configs = {
    no_scan: {
      label: "No Scan",
      className: "bg-white text-slate-950 border-slate-400",
    },
    parse_failed: {
      label: "Parse Failed",
      className: "bg-red-100 text-red-950 border-red-300",
    },
    low_confidence: {
      label: `Low Confidence — ${
        lead.confidence_score != null
          ? Math.round(lead.confidence_score * 100) + "%"
          : "?%"
      }`,
      className: "bg-amber-100 text-amber-950 border-amber-300",
    },
  };
  return configs[lead.review_reason] ?? configs.no_scan;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function NeedsReviewTab({ needsReview, isLoading }: NeedsReviewTabProps) {
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [localRemoved, setLocalRemoved] = useState<Set<string>>(new Set());
  const [manualEntryLead, setManualEntryLead] = useState<NeedsReviewLead | null>(null);
  const [manualForm, setManualForm] = useState<ManualEntryForm>({
    contractorName: "",
    totalPrice: "",
    productBrand: "",
    notes: "",
  });
  const [manualSaving, setManualSaving] = useState(false);

  const visibleLeads = needsReview.filter((l) => !localRemoved.has(l.id));

  /* ── Handlers ────────────────────────────────────────────────────── */

  const handleRescan = async (lead: NeedsReviewLead) => {
    setActionInFlight(lead.id);
    try {
      const result = await invokeAdminData("rescan_lead", { lead_id: lead.id });
      if (result?.success) {
        toast.success("Re-scan triggered successfully");
        setLocalRemoved((prev) => new Set([...prev, lead.id]));
      } else {
        toast.error(result?.error ?? "Re-scan failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as any).message) : "Re-scan failed";
      toast.error(msg);
    } finally {
      setActionInFlight(null);
    }
  };

  const handleManualSave = async () => {
    if (!manualEntryLead) return;
    setManualSaving(true);
    try {
      const result = await invokeAdminData("update_lead_manual_entry", {
        lead_id: manualEntryLead.id,
        manual_entry_data: {
          contractorName: manualForm.contractorName,
          totalPrice: parseFloat(manualForm.totalPrice) || 0,
          productBrand: manualForm.productBrand,
          notes: manualForm.notes,
        },
      });
      if (result?.success) {
        toast.success("Manual entry saved");
        setLocalRemoved((prev) => new Set([...prev, manualEntryLead.id]));
        setManualEntryLead(null);
      } else {
        toast.error("Failed to save manual entry");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setManualSaving(false);
    }
  };

  /* ── Loading state ───────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-muted/30 rounded-lg h-16 w-full" />
        ))}
      </div>
    );
  }

  /* ── Empty state ─────────────────────────────────────────────────── */

  if (visibleLeads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-slate-700">
        <CheckCircle className="w-10 h-10 text-emerald-700" />
        <p className="text-base font-bold">All scans processed successfully.</p>
        <p className="text-sm font-semibold">Failed or missing analyses will appear here.</p>
      </div>
    );
  }

  /* ── Table ───────────────────────────────────────────────────────── */

  return (
    <>
      <div className="rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100 text-sm uppercase tracking-wide text-slate-700">
              <th className="px-4 py-3 text-left">Lead</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Image</th>
              <th className="px-4 py-3 text-left">Error Note</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleLeads.map((lead) => {
              const reason = getReasonConfig(lead);
              const isActioning = actionInFlight === lead.id;

              const errorText =
                lead.analysis_error ??
                (lead.review_reason === "no_scan"
                  ? "Scan never completed"
                  : lead.review_reason === "low_confidence"
                  ? "Confidence below threshold"
                  : lead.analysis_status ?? "Unknown error");

              return (
                <tr
                  key={lead.id}
                  className="min-h-[72px] border-b border-slate-300 bg-white hover:bg-blue-50/60 transition-colors"
                >
                  {/* Lead */}
                  <td className="px-4 py-3">
                    <p className="text-base font-black text-slate-950">
                      {[lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
                        `Lead ${lead.id.slice(0, 8)}`}
                    </p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {format(new Date(lead.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                    {(lead.phone_e164 || lead.email) && (
                      <div className="flex flex-col gap-0.5 mt-1">
                        {lead.phone_e164 && (
                          <span className="text-sm font-medium text-slate-700">
                            {formatPhoneDisplay(stripNonDigits(lead.phone_e164).replace(/^1/, ""))}
                          </span>
                        )}
                        {lead.email && (
                          <span className="text-sm font-medium text-slate-700 truncate max-w-[160px]" title={lead.email}>
                            {lead.email}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Reason Badge */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex min-h-8 items-center text-sm font-bold px-2.5 py-1 rounded border shadow-sm ${reason.className}`}
                    >
                      {reason.label}
                    </span>
                  </td>

                  {/* Image Thumbnail */}
                  <td className="px-4 py-3">
                    {lead.quote_image_url ? (
                      <a href={lead.quote_image_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={lead.quote_image_url}
                          alt="Quote"
                          className="w-12 h-12 rounded object-cover border border-border hover:opacity-80 transition-opacity cursor-zoom-in"
                        />
                      </a>
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted/30 border border-border flex items-center justify-center">
                        <ImageOff className="w-4 h-4 text-slate-700" />
                      </div>
                    )}
                  </td>

                  {/* Error Note */}
                  <td className="px-4 py-3">
                    <p
                      className="text-sm font-semibold text-slate-800 max-w-[220px] truncate"
                      title={errorText}
                    >
                      {errorText}
                    </p>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        disabled={isActioning || !lead.latest_scan_session_id}
                        onClick={() => handleRescan(lead)}
                        className="inline-flex min-h-10 items-center gap-1 px-4 py-2 rounded border-2 border-blue-300 bg-blue-100 text-sm font-extrabold text-blue-950 hover:bg-blue-200 disabled:cursor-not-allowed transition-colors"
                      >
                        {isActioning ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Re-Scan
                      </button>

                      <button
                        disabled={isActioning}
                        onClick={() => {
                          setManualEntryLead(lead);
                          setManualForm({
                            contractorName: "",
                            totalPrice: "",
                            productBrand: "",
                            notes: "",
                          });
                        }}
                        className="inline-flex min-h-10 items-center gap-1 px-4 py-2 rounded border-2 border-orange-300 bg-orange-100 text-sm font-extrabold text-orange-950 hover:bg-orange-200 disabled:cursor-not-allowed transition-colors"
                      >
                        <PenLine className="w-3 h-3" />
                        Manual Entry
                      </button>

                      <button
                        disabled={isActioning}
                        onClick={async () => {
                          setActionInFlight(lead.id);
                          try {
                            await updateLeadManualEntry({ lead_id: lead.id, manually_reviewed: true });
                            toast.success("Marked as reviewed");
                            setLocalRemoved((prev) => new Set([...prev, lead.id]));
                          } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : "Failed to mark reviewed";
                            toast.error(msg);
                          } finally {
                            setActionInFlight(null);
                          }
                        }}
                        className="inline-flex min-h-10 items-center gap-1 px-4 py-2 rounded border-2 border-emerald-300 bg-emerald-100 text-sm font-extrabold text-emerald-950 hover:bg-emerald-200 disabled:cursor-not-allowed transition-colors"
                      >
                        {isActioning ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3 h-3" />
                        )}
                        Reviewed
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Manual Entry Sheet */}
      <Sheet open={!!manualEntryLead} onOpenChange={(open) => !open && setManualEntryLead(null)}>
        <SheetContent side="right" className="w-[400px]">
          <SheetHeader>
            <SheetTitle>Manual Entry</SheetTitle>
            <SheetDescription>
              {manualEntryLead
                ? [manualEntryLead.first_name, manualEntryLead.last_name]
                    .filter(Boolean)
                    .join(" ") || "Unknown Lead"
                : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                Contractor Name
              </label>
              <Input
                value={manualForm.contractorName}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, contractorName: e.target.value }))
                }
                placeholder="e.g. ABC Windows LLC"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                Total Price ($)
              </label>
              <Input
                type="number"
                value={manualForm.totalPrice}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, totalPrice: e.target.value }))
                }
                placeholder="e.g. 18500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                Product Brand
              </label>
              <Input
                value={manualForm.productBrand}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, productBrand: e.target.value }))
                }
                placeholder="e.g. PGT, Impact Innovations"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
                Notes (optional)
              </label>
              <Textarea
                value={manualForm.notes}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Any additional context about this quote..."
                rows={3}
              />
            </div>
          </div>

          <SheetFooter className="mt-8">
            <Button
              variant="ghost"
              onClick={() => setManualEntryLead(null)}
              disabled={manualSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleManualSave}
              disabled={manualSaving || !manualForm.contractorName}
              className="bg-amber-500 hover:bg-amber-400 text-black"
            >
              {manualSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Entry
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
