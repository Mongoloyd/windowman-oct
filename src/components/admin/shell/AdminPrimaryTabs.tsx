/**
 * AdminPrimaryTabs — Curated tab strip for the admin dashboard.
 *
 * Replaces the previous 35-tab wrapped list with a focused set of operator
 * surfaces. Other tabs remain mounted in <Tabs> so deep-links keep working,
 * they just don't appear in the visible nav.
 */

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export interface AdminPrimaryTabsProps {
  ghostCount?: number;
  needsReviewCount?: number;
}

interface TabDef {
  value: string;
  label: string;
  /** Only shown when count > 0 */
  count?: number;
  variant?: "destructive" | "default";
}

export function AdminPrimaryTabs({
  ghostCount = 0,
  needsReviewCount = 0,
}: AdminPrimaryTabsProps) {
  const tabs: TabDef[] = [
    { value: "launch", label: "Launch Control" },
    { value: "command", label: "Command Center" },
    { value: "pipeline", label: "Active Pipeline" },
    { value: "routing", label: "Routing" },
    { value: "ghosts", label: "Ghost Recovery", count: ghostCount, variant: "destructive" },
    { value: "needs-review", label: "Needs Review", count: needsReviewCount, variant: "destructive" },
    { value: "engine", label: "Dialer Desk" },
    { value: "contractors", label: "Contractors" },
    { value: "onboarding", label: "Onboarding" },
    { value: "outcomes", label: "Outcomes" },
    { value: "attribution", label: "Attribution" },
    { value: "delivery-inspector", label: "Delivery Inspector" },
    { value: "session-diag", label: "Session Diag" },
  ];

  return (
    <TabsList className="flex w-full flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
      {tabs.map((t) => (
        <TabsTrigger
          key={t.value}
          value={t.value}
          className="
            flex-1 min-w-[110px]
            data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm
            text-muted-foreground hover:text-foreground hover:bg-card/60
            text-sm font-medium
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            transition-colors
          "
        >
          <span className="truncate">{t.label}</span>
          {t.count != null && t.count > 0 && (
            <Badge
              variant={t.variant ?? "default"}
              className="ml-1.5 h-5 min-w-[20px] px-1 text-[10px]"
            >
              {t.count > 99 ? "99+" : t.count}
            </Badge>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
