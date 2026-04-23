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
  "flex-1 min-w-[110px]",
  "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  "text-muted-foreground hover:text-foreground hover:bg-card/60",
  "text-sm font-medium",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "transition-colors",
  // Match Radix TabsTrigger sizing so route-tabs line up identically with panel-tabs
  "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5",
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
    { kind: "panel", value: "launch", label: "Launch Control" },
    { kind: "panel", value: "command", label: "Command Center" },
    { kind: "panel", value: "pipeline", label: "Active Pipeline" },
    { kind: "panel", value: "routing", label: "Routing" },
    { kind: "panel", value: "ghosts", label: "Ghost Recovery", count: ghostCount, variant: "destructive" },
    { kind: "panel", value: "needs-review", label: "Needs Review", count: needsReviewCount, variant: "destructive" },
    { kind: "panel", value: "engine", label: "Dialer Desk" },
    { kind: "panel", value: "contractors", label: "Contractors" },
    { kind: "panel", value: "onboarding", label: "Onboarding" },
    { kind: "panel", value: "outcomes", label: "Outcomes" },
    { kind: "panel", value: "attribution", label: "Attribution" },
    { kind: "panel", value: "delivery-inspector", label: "Delivery Inspector" },
    { kind: "panel", value: "session-diag", label: "Session Diag" },
  ];

  function renderCount(count?: number, variant?: "destructive" | "default") {
    if (count == null || count <= 0) return null;
    return (
      <Badge
        variant={variant ?? "default"}
        className="ml-1.5 h-5 min-w-[20px] px-1 text-[10px]"
      >
        {count > 99 ? "99+" : count}
      </Badge>
    );
  }

  return (
    <TabsList className="flex w-full flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
      {tabs.map((t) => {
        if (t.kind === "panel") {
          return (
            <TabsTrigger
              key={`panel:${t.value}`}
              value={t.value}
              className={TAB_TRIGGER_CLASSES}
            >
              <span className="truncate">{t.label}</span>
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
            <span className="truncate">{t.label}</span>
            {renderCount(t.count, t.variant)}
          </Link>
        );
      })}
    </TabsList>
  );
}
