/**
 * AdminPrimaryTabs — Curated tab strip for the admin dashboard.
 *
 * Mixes two kinds of entries:
 *   1. **Panel tabs** — Radix <TabsTrigger> values that switch the in-page panel.
 *   2. **Route tabs** — react-router <Link>s styled identically to TabsTrigger
 *      that navigate to a sibling /admin/* route. Active state is derived from
 *      useLocation() so the highlight persists on dynamic sub-routes
 *      (e.g. "Lead Inbox" stays active on /admin/leads/:id).
 */

import { Link, useLocation } from "react-router-dom";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export interface AdminPrimaryTabsProps {
  ghostCount?: number;
  needsReviewCount?: number;
}

interface PanelTabDef {
  kind: "panel";
  value: string;
  label: string;
  count?: number;
  variant?: "destructive" | "default";
  /** Optional pathname that should also highlight this panel tab when active. */
  routeAlias?: string;
}

interface RouteTabDef {
  kind: "route";
  to: string;
  /** Routes (including dynamic children) that should keep this tab highlighted. */
  matchPrefixes: string[];
  label: string;
  count?: number;
  variant?: "destructive" | "default";
}

type TabDef = PanelTabDef | RouteTabDef;

// Shared className so route-tabs are visually indistinguishable from panel-tabs.
const TAB_TRIGGER_CLASSES = [
  "shrink-0 min-w-fit",
  "data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:border-slate-400 data-[state=active]:shadow-sm data-[state=active]:font-black",
  "bg-slate-50 text-slate-800 hover:text-slate-950 hover:bg-white hover:border-slate-400 hover:shadow-sm",
  "text-sm font-bold",
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2",
  "transition-all border border-slate-300",
  // Match Radix TabsTrigger sizing so route-tabs line up identically with panel-tabs
  "inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-2 sm:px-4",
].join(" ");

export function AdminPrimaryTabs({
  ghostCount = 0,
  needsReviewCount = 0,
}: AdminPrimaryTabsProps) {
  const location = useLocation();

  const tabs: TabDef[] = [
    {
      kind: "route",
      to: "/admin/leads",
      matchPrefixes: ["/admin/leads"],
      label: "Lead Inbox",
    },
    {
      kind: "route",
      to: "/admin/command-center",
      matchPrefixes: ["/admin/command-center"],
      label: "Mission",
    },
    { kind: "route", to: "/admin/launch", matchPrefixes: ["/admin/launch"], label: "Launch" },
    { kind: "route", to: "/admin/command", matchPrefixes: ["/admin/command"], label: "Command" },
    { kind: "route", to: "/admin/pipeline", matchPrefixes: ["/admin/pipeline"], label: "Pipeline" },
    { kind: "route", to: "/admin/routing", matchPrefixes: ["/admin/routing"], label: "Routing" },
    { kind: "route", to: "/admin/ghosts", matchPrefixes: ["/admin/ghosts"], label: "Ghosts", count: ghostCount, variant: "destructive" },
    { kind: "route", to: "/admin/needs-review", matchPrefixes: ["/admin/needs-review"], label: "Review", count: needsReviewCount, variant: "destructive" },
    { kind: "route", to: "/admin/dialer", matchPrefixes: ["/admin/dialer"], label: "Dialer" },
    { kind: "route", to: "/admin/contractors", matchPrefixes: ["/admin/contractors"], label: "Contractors" },
    { kind: "route", to: "/admin/outcomes", matchPrefixes: ["/admin/outcomes"], label: "Outcomes" },
    { kind: "route", to: "/admin/attribution", matchPrefixes: ["/admin/attribution"], label: "Attribution" },
    { kind: "route", to: "/admin/signal-dispatch", matchPrefixes: ["/admin/signal-dispatch"], label: "Signals" },
    { kind: "panel", value: "delivery-inspector", label: "Delivery" },
    { kind: "panel", value: "session-diag", label: "Sessions" },
  ];

  function renderCount(count?: number, variant?: "destructive" | "default") {
    if (count == null || count <= 0) return null;
    return (
      <Badge
        variant={variant ?? "default"}
        className="ml-1.5 min-h-6 min-w-[24px] border border-slate-400 bg-white px-2 text-sm font-extrabold text-slate-950 shadow-sm"
      >
        {count > 99 ? "99+" : count}
      </Badge>
    );
  }

  return (
    <TabsList className="wm-slim-scrollbar flex h-auto w-full flex-nowrap justify-start gap-2 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-300 bg-white p-2 shadow-sm [scrollbar-gutter:stable]">
      {tabs.map((t) => {
        if (t.kind === "panel") {
          return (
            <TabsTrigger
              key={`panel:${t.value}`}
              value={t.value}
              aria-label={t.label}
              className={TAB_TRIGGER_CLASSES}
            >
              <span>{t.label}</span>
              {renderCount(t.count, t.variant)}
            </TabsTrigger>
          );
        }

        const isActive = t.matchPrefixes.some(
          (prefix) =>
            location.pathname === prefix ||
            location.pathname.startsWith(`${prefix}/`),
        );

        return (
          <Link
            key={`route:${t.to}`}
            to={t.to}
            data-state={isActive ? "active" : "inactive"}
            aria-current={isActive ? "page" : undefined}
            className={TAB_TRIGGER_CLASSES}
          >
            <span>{t.label}</span>
            {renderCount(t.count, t.variant)}
          </Link>
        );
      })}
    </TabsList>
  );
}
