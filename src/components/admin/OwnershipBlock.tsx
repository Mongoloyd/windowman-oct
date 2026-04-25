/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OWNERSHIP BLOCK — Phase 7: Ownership Ledger Foundation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Operator-safe, read-only block surfacing repo-real ownership context for
 * a single opportunity. Renders ONLY fields that are present on real data:
 *
 *   • Current Owner    — latest contractor_opportunity_routes.contractor_id
 *   • Prior Owner(s)   — derived from older route rows (multi-row history)
 *   • Assignment State — derived from route_status / release_status / contact_released
 *   • Release Status   — repo-real release_status + release_requested_at
 *   • Recovery flag    — repo-real (report_unlocked >14d AND never routed)
 *   • Reassignable     — repo-real derivation (released OR no active route + history)
 *
 * Nothing here is fabricated. If only some fields exist, only those render.
 * Multiple route rows on the same opportunity ARE the ownership ledger.
 */

import { Building2, History, Unlock, RotateCcw, ShieldCheck, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { RoutingRoute, RoutingContractor, OwnershipBadge } from "@/types/routingDesk";

interface OwnershipBlockProps {
  /** All route rows for this opportunity, any order. */
  routes: RoutingRoute[];
  /** All contractors known to admin (for name lookup). */
  contractors: RoutingContractor[];
  /**
   * Optional lead-level lifecycle context for recovery derivation.
   * Pass when rendering at the lead level; omit when only opportunity
   * data is in scope.
   */
  reportUnlockedAt?: string | null;
  routedToContractorAt?: string | null;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const BADGE_LABEL: Record<OwnershipBadge, string> = {
  currently_assigned: "Currently Assigned",
  released: "Contact Released",
  previously_assigned: "Has Prior Owner",
  recovery_candidate: "Recovery Candidate (operator view)",
  reassignable: "Reassignable",
};

const BADGE_TONE: Record<OwnershipBadge, string> = {
  currently_assigned: "border-cyan-500/40 text-cyan-700 bg-cyan-500/10",
  released: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10",
  previously_assigned: "border-violet-500/40 text-violet-700 bg-violet-500/10",
  recovery_candidate: "border-amber-500/40 text-amber-700 bg-amber-500/10",
  reassignable: "border-slate-500/40 text-slate-700 bg-slate-500/10",
};

const BADGE_ICON: Record<OwnershipBadge, React.ElementType> = {
  currently_assigned: Building2,
  released: Unlock,
  previously_assigned: History,
  recovery_candidate: AlertCircle,
  reassignable: RotateCcw,
};

/**
 * Compute the operator-derived ownership badges from repo-real data.
 * Pure / deterministic / safe to memoize at call-site.
 */
export function deriveOwnershipBadges(args: {
  routes: RoutingRoute[];
  reportUnlockedAt?: string | null;
  routedToContractorAt?: string | null;
}): OwnershipBadge[] {
  const { routes, reportUnlockedAt, routedToContractorAt } = args;
  const badges: OwnershipBadge[] = [];
  const now = Date.now();

  const sorted = [...routes].sort(
    (a, b) => new Date(b.sent_at ?? b.created_at).getTime()
            - new Date(a.sent_at ?? a.created_at).getTime(),
  );
  const latest = sorted[0] ?? null;

  // Currently assigned: a latest route exists and contact is NOT released yet.
  const released = !!latest && (
    latest.contact_released === true || latest.release_status === "approved"
  );
  if (latest && !released) badges.push("currently_assigned");
  if (released) badges.push("released");

  // Prior owners present (≥2 routes OR a single route from a different contractor).
  const distinctContractors = new Set(routes.map((r) => r.contractor_id));
  if (routes.length >= 2 || distinctContractors.size >= 2) {
    badges.push("previously_assigned");
  }

  // Reassignable: released OR (no active route + at least one prior route).
  if (released || (routes.length > 0 && !latest)) {
    badges.push("reassignable");
  }

  // Recovery candidate: lead unlocked >14d ago, never routed.
  if (reportUnlockedAt && !routedToContractorAt) {
    const unlockedTime = new Date(reportUnlockedAt).getTime();
    if (now - unlockedTime > FOURTEEN_DAYS_MS) badges.push("recovery_candidate");
  }

  return badges;
}

function fmtTs(ts: string | null): string {
  if (!ts) return "—";
  return format(new Date(ts), "MMM d, yyyy h:mm a");
}

export function OwnershipBlock({
  routes,
  contractors,
  reportUnlockedAt,
  routedToContractorAt,
}: OwnershipBlockProps) {
  const sorted = [...routes].sort(
    (a, b) => new Date(b.sent_at ?? b.created_at).getTime()
            - new Date(a.sent_at ?? a.created_at).getTime(),
  );
  const latest = sorted[0] ?? null;
  const prior = sorted.slice(1);

  const contractorById = new Map(contractors.map((c) => [c.id, c]));

  const currentOwner = latest ? contractorById.get(latest.contractor_id) ?? null : null;

  // Distinct prior owner contractors (excluding the current one if same).
  const priorOwnerNames: string[] = [];
  const seen = new Set<string>();
  for (const r of prior) {
    if (r.contractor_id === latest?.contractor_id) continue;
    if (seen.has(r.contractor_id)) continue;
    seen.add(r.contractor_id);
    const c = contractorById.get(r.contractor_id);
    if (c) priorOwnerNames.push(c.company_name);
  }

  const badges = deriveOwnershipBadges({
    routes,
    reportUnlockedAt,
    routedToContractorAt,
  });

  // Don't render an empty shell — only render when there's at least one real signal.
  const hasAnything = !!latest || !!reportUnlockedAt || badges.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-slate-700" />
        <p className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold">
          Ownership
        </p>
      </div>

      {/* Current owner */}
      <div className="flex items-start gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold w-24 mt-0.5 shrink-0">
          Current Owner
        </span>
        {currentOwner ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Building2 className="h-3 w-3 text-cyan-600" />
            <span className="font-medium">{currentOwner.company_name}</span>
            {latest?.routing_reason && (
              <span className="text-[10px] text-slate-700 italic">· {latest.routing_reason}</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-slate-700 italic">Unassigned</span>
        )}
      </div>

      {/* Prior owners */}
      {priorOwnerNames.length > 0 && (
        <div className="flex items-start gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold w-24 mt-0.5 shrink-0">
            Prior Owner{priorOwnerNames.length > 1 ? "s" : ""}
          </span>
          <span className="text-xs text-slate-700">
            {priorOwnerNames.join(" · ")}
          </span>
        </div>
      )}

      {/* Release status (only when meaningful) */}
      {latest && latest.release_status && latest.release_status !== "none" && (
        <div className="flex items-start gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-700 font-semibold w-24 mt-0.5 shrink-0">
            Release
          </span>
          <div className="text-xs space-y-0.5">
            <span className="capitalize font-medium">{latest.release_status}</span>
            {latest.release_requested_at && (
              <span className="text-slate-700"> · requested {fmtTs(latest.release_requested_at)}</span>
            )}
            {latest.release_reviewed_at && (
              <div className="text-slate-700 text-[11px]">
                Reviewed {fmtTs(latest.release_reviewed_at)}
                {latest.release_denial_reason && ` — ${latest.release_denial_reason}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Operator-derived badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
          {badges.map((b) => {
            const Icon = BADGE_ICON[b];
            return (
              <Badge
                key={b}
                className={`text-[10px] gap-1 border ${BADGE_TONE[b]}`}
                variant="outline"
              >
                <Icon className="h-3 w-3" />
                {BADGE_LABEL[b]}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
