/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SHARED MARKET READINESS — Phase 8: Future Direction (informational only)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Scoped, INFORMATIONAL-ONLY section that signals where future shared-market
 * controls will live, without inventing fake controls today.
 *
 * Strict rules enforced in this component:
 *   • No onClick handlers. No useState. No mutations.
 *   • Switches are visually disabled and have NO event handler.
 *   • Badges are static placeholder labels (e.g., "Coming Later").
 *   • Nothing in this file pretends to be wired to a backend.
 *   • Nothing here invents seats, billing, ad accounts, or pixel routing.
 *
 * If/when a future phase adds real backend support, this section is the
 * intended home for the controls — but ONLY when real fields exist.
 */

import {
  Network, MapPinned, Route as RouteIcon, Radio, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReadinessRowProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function ReadinessRow({ icon: Icon, title, description }: ReadinessRowProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-white/70">
      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-700" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <Badge
            variant="outline"
            className="text-[10px] border-slate-200 text-slate-700 bg-slate-50"
          >
            Coming Later
          </Badge>
        </div>
        <p className="text-xs text-slate-700 mt-1 leading-relaxed">{description}</p>

        {/* Visually-disabled toggle. No onClick, no state, no handler. */}
        <div
          className="mt-3 flex items-center gap-2 opacity-100 select-none"
          aria-disabled="true"
        >
          <div
            className="w-9 h-5 rounded-full bg-slate-200 relative"
            role="presentation"
          >
            <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm" />
          </div>
          <span className="text-[11px] text-slate-700 italic">
            Disabled — no backend support yet
          </span>
        </div>
      </div>
    </div>
  );
}

export function SharedMarketReadinessSection() {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.04)] overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
          <Network className="w-4 h-4 text-slate-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            Shared Market Network — Future Direction
          </h2>
          <p className="text-[11px] text-slate-700 mt-0.5">
            Informational only. These surfaces will activate when their backend
            support exists.
          </p>
        </div>
      </header>

      <div className="p-5 space-y-3">
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-900/80 leading-relaxed">
            Today the system runs as a single-contractor delivery spine. The
            sections below describe where shared-market controls will live as
            additional contractors and overlapping markets are introduced.
            Nothing here is active.
          </p>
        </div>

        <ReadinessRow
          icon={MapPinned}
          title="Future Partner & Seat Management"
          description="When a second contractor is onboarded, partner accounts, market seats, and per-county presence will be configured here. No seat or billing system is wired today."
        />

        <ReadinessRow
          icon={RouteIcon}
          title="Future Routing Policy"
          description="Manual shared-market routing rules (priority, exclusivity windows, recovery handoff) will live here. Today routing remains operator-driven through the Routing Desk."
        />

        <ReadinessRow
          icon={Radio}
          title="Future Signal Layer Strategy"
          description="Aggregated market signals (response times, engagement patterns, recovery cadence) will be surfaced here once enough multi-partner activity exists to derive them honestly."
        />
      </div>
    </section>
  );
}
