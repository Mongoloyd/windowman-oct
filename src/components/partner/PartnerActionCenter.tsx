/**
 * PartnerActionCenter — compact live partner work desk for the dossier.
 *
 * Sprint 1D: shows current disposition pill, advance-to-next-status dropdown,
 * Mark Sold and Mark Lost actions, and the last action timestamp. All writes
 * route through the `partner-update-disposition` edge function — never direct
 * to Supabase.
 *
 * Disabled in preview/locked states. Sold requires positive final value;
 * Lost requires a reason code.
 */
import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, Lock, Loader2, Upload, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DISPOSITION_STATE,
  DISPOSITION_TRANSITIONS,
  DISPOSITION_REASON_CODE,
  type DispositionState,
  type DispositionReasonCode,
} from "@/lib/statusConstants";

export interface PartnerOutcome {
  id: string;
  opportunity_id: string;
  lead_id: string | null;
  contractor_id: string;
  disposition_state: DispositionState;
  disposition_reason_code: string | null;
  projected_value_cents: number | null;
  final_value_cents: number | null;
  signed_contract_url: string | null;
  last_partner_action_at: string | null;
}

interface Props {
  outcome: PartnerOutcome | null;
  opportunityId: string | null;
  isPreview: boolean;
  isLocked: boolean;
  onUpdated?: () => void;
}

const STATE_LABELS: Record<DispositionState, string> = {
  new: "New",
  attempting_contact: "Attempting Contact",
  meeting_scheduled: "Meeting Scheduled",
  quote_delivered: "Quote Delivered",
  sold_closed: "Sold",
  lost_dead: "Lost",
};

const STATE_PILL_CLASSES: Record<DispositionState, string> = {
  new: "bg-blue-100 text-blue-950 border-blue-300",
  attempting_contact: "bg-amber-100 text-amber-950 border-amber-300",
  meeting_scheduled: "bg-blue-100 text-blue-950 border-blue-300",
  quote_delivered: "bg-blue-100 text-blue-950 border-blue-300",
  sold_closed: "bg-emerald-100 text-emerald-950 border-emerald-300",
  lost_dead: "bg-white text-slate-950 border-slate-400",
};

const REASON_LABELS: Record<DispositionReasonCode, string> = {
  price_too_high: "Price too high",
  chose_competitor: "Chose competitor",
  no_longer_interested: "No longer interested",
  unresponsive: "Unresponsive",
  project_canceled: "Project canceled",
  out_of_service_area: "Out of service area",
  other: "Other",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "No actions yet";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function PartnerActionCenter({
  outcome,
  opportunityId,
  isPreview,
  isLocked,
  onUpdated,
}: Props) {
  const [showAdvance, setShowAdvance] = useState(false);
  const [showSold, setShowSold] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentState: DispositionState = (outcome?.disposition_state as DispositionState) ?? "new";
  const allowedNext = useMemo(
    () => DISPOSITION_TRANSITIONS[currentState] ?? [],
    [currentState],
  );
  const canMutate = !isPreview && !isLocked && !!opportunityId;
  const isTerminal = currentState === "sold_closed" || currentState === "lost_dead";
  const advanceableStates = allowedNext.filter(
    (s) => s !== "sold_closed" && s !== "lost_dead",
  );
  const canMarkSold = allowedNext.includes("sold_closed");
  const canMarkLost = allowedNext.includes("lost_dead");

  async function callUpdate(body: Record<string, unknown>) {
    if (!canMutate) {
      if (isPreview) toast.info("CRM updates are available on live unlocked leads.");
      return false;
    }
    if (!opportunityId) {
      toast.error("No opportunity linked to this dossier.");
      return false;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "partner-update-disposition",
        { body: { ...body, opportunity_id: opportunityId } },
      );
      if (error) {
        toast.error(error.message ?? "Update failed.");
        return false;
      }
      if (data?.error) {
        toast.error(data.message ?? "Update rejected.");
        return false;
      }
      toast.success("Status updated.");
      onUpdated?.();
      return true;
    } catch {
      toast.error("Network error.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Partner Action Center"
      className="rounded-xl border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* ── Left: status pill + last action ── */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-700 font-extrabold">
              CRM Status
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${STATE_PILL_CLASSES[currentState]}`}
              >
                {STATE_LABELS[currentState]}
              </span>
              <span className="text-sm text-slate-700 font-bold font-mono">
                {formatRelative(outcome?.last_partner_action_at ?? null)}
              </span>
              {isPreview && (
                <span className="text-xs uppercase tracking-wider text-slate-950 bg-white border border-slate-400 px-1.5 py-0.5 rounded">
                  Demo
                </span>
              )}
              {!isPreview && isLocked && (
                <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-slate-950 bg-white border border-slate-400 px-1.5 py-0.5 rounded">
                  <Lock className="h-2.5 w-2.5" /> Locked
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: actions ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Advance dropdown — only if non-terminal next states exist */}
          {advanceableStates.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAdvance((v) => !v)}
                disabled={!canMutate || submitting || isTerminal}
                className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-md text-sm font-extrabold border border-slate-300 bg-white text-slate-950 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed transition-colors"
              >
                Advance Status <ChevronDown className="h-3 w-3" />
              </button>
              {showAdvance && canMutate && !isTerminal && (
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-md border bg-card shadow-lg py-1">
                  {advanceableStates.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={async () => {
                        setShowAdvance(false);
                        await callUpdate({ disposition_state: s });
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                    >
                      → {STATE_LABELS[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {canMarkSold && (
            <button
              type="button"
              onClick={() => {
                if (!canMutate) {
                  if (isPreview) toast.info("CRM updates are available on live unlocked leads.");
                  return;
                }
                setShowSold(true);
              }}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-md text-sm font-extrabold border border-emerald-900 bg-emerald-900 text-white hover:bg-emerald-800 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Sold
            </button>
          )}

          {canMarkLost && (
            <button
              type="button"
              onClick={() => {
                if (!canMutate) {
                  if (isPreview) toast.info("CRM updates are available on live unlocked leads.");
                  return;
                }
                setShowLost(true);
              }}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-md text-sm font-extrabold border border-slate-300 bg-white text-slate-950 hover:bg-slate-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" /> Mark Lost
            </button>
          )}

          {isTerminal && (
            <span className="text-sm text-slate-700 font-semibold italic">
              Outcome closed — no further actions.
            </span>
          )}
        </div>
      </div>

      {/* ── Inline notes ── */}
      {!isPreview && isLocked && !isTerminal && (
        <p className="mt-3 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
          Unlock the lead to enable CRM status updates.
        </p>
      )}
      {isPreview && (
        <p className="mt-3 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded px-2 py-1.5">
          CRM updates are available on live unlocked leads.
        </p>
      )}

      {/* ── Sold modal ── */}
      {showSold && (
        <SoldModal
          submitting={submitting}
          onCancel={() => setShowSold(false)}
          onSubmit={async (payload) => {
            const ok = await callUpdate({
              disposition_state: DISPOSITION_STATE.SOLD_CLOSED,
              ...payload,
            });
            if (ok) setShowSold(false);
          }}
        />
      )}

      {/* ── Lost modal ── */}
      {showLost && (
        <LostModal
          submitting={submitting}
          onCancel={() => setShowLost(false)}
          onSubmit={async (payload) => {
            const ok = await callUpdate({
              disposition_state: DISPOSITION_STATE.LOST_DEAD,
              ...payload,
            });
            if (ok) setShowLost(false);
          }}
        />
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Sold modal                                                      */
/* ─────────────────────────────────────────────────────────────── */
function SoldModal({
  submitting,
  onCancel,
  onSubmit,
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    final_value_cents: number;
    projected_value_cents?: number;
    notes?: string;
  }) => void | Promise<void>;
}) {
  const [finalValue, setFinalValue] = useState("");
  const [projectedValue, setProjectedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const finalDollars = parseFloat(finalValue);
    if (!Number.isFinite(finalDollars) || finalDollars <= 0) {
      setError("Final contract value must be a positive number.");
      return;
    }
    setError(null);
    const payload: {
      final_value_cents: number;
      projected_value_cents?: number;
      notes?: string;
    } = {
      final_value_cents: Math.round(finalDollars * 100),
    };
    const projected = parseFloat(projectedValue);
    if (Number.isFinite(projected) && projected >= 0) {
      payload.projected_value_cents = Math.round(projected * 100);
    }
    if (notes.trim()) payload.notes = notes.trim();
    onSubmit(payload);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mark Sold"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl space-y-4"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-bold">Mark as Sold</h3>
        </div>

        <div className="space-y-1">
          <label htmlFor="final-value" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Final Contract Value (USD) <span className="text-destructive">*</span>
          </label>
          <input
            id="final-value"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            value={finalValue}
            onChange={(e) => setFinalValue(e.target.value)}
            placeholder="22500"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="projected-value" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Projected Value (optional)
          </label>
          <input
            id="projected-value"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={projectedValue}
            onChange={(e) => setProjectedValue(e.target.value)}
            placeholder="20000"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="sold-notes" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Notes (optional)
          </label>
          <textarea
            id="sold-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember about this deal…"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Signed Contract (optional)
          </p>
          <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-4 rounded-md border-2 border-dashed border-border bg-muted/30 text-center">
            <Upload className="h-4 w-4 text-slate-700" />
            <p className="text-[11px] text-slate-700">
              Proof upload coming soon
            </p>
            <p className="text-[10px] text-slate-700">
              You can mark Sold without proof for now.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-10 px-4 py-2 rounded-md text-sm font-extrabold text-slate-700 border border-slate-300 bg-white hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-md text-sm font-extrabold border bg-emerald-900 text-white hover:bg-emerald-800 transition-colors shadow-sm"
          >
            {submitting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : (
              <>Confirm Sold</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* Lost modal                                                      */
/* ─────────────────────────────────────────────────────────────── */
function LostModal({
  submitting,
  onCancel,
  onSubmit,
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    disposition_reason_code: DispositionReasonCode;
    notes?: string;
  }) => void | Promise<void>;
}) {
  const [reason, setReason] = useState<DispositionReasonCode | "">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Please select a reason.");
      return;
    }
    const trimmed = notes.trim();
    if (!trimmed) {
      setError("A typed loss reason is required.");
      return;
    }
    setError(null);
    onSubmit({
      disposition_reason_code: reason,
      notes: trimmed,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mark Lost"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-xl space-y-4"
      >
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-slate-700" />
          <h3 className="text-base font-bold">Mark as Lost</h3>
        </div>

        <div className="space-y-1">
          <label htmlFor="lost-reason" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            Reason <span className="text-destructive">*</span>
          </label>
          <select
            id="lost-reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value as DispositionReasonCode)}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select a reason…</option>
            {Object.values(DISPOSITION_REASON_CODE).map((code) => (
              <option key={code} value={code}>
                {REASON_LABELS[code]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="lost-notes" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            What happened? <span className="text-destructive">*</span>
          </label>
          <textarea
            id="lost-notes"
            rows={3}
            required
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what happened with this lead (required)…"
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <p className="text-[10px] text-slate-700">
            A typed explanation is required so we can learn from lost deals.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="min-h-10 px-4 py-2 rounded-md text-sm font-extrabold text-slate-700 border border-slate-300 bg-white hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-md text-sm font-extrabold border bg-foreground text-background hover:bg-foreground/90 disabled:opacity-100 transition-colors"
          >
            {submitting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : (
              <>Confirm Lost</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
