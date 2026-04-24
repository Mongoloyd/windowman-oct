/**
 * PartnerPortalNav — primary nav strip for the partner portal.
 *
 * Mirrors the AdminPrimaryTabs visual pattern (rounded muted strip,
 * shadcn-style active state) so the partner shell feels native to the
 * existing admin/SaaS surface rather than a separate app.
 *
 * Dossier is intentionally NOT a primary nav item — it's a child detail
 * view reached from the Opportunity Market.
 */

import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, LifeBuoy } from "lucide-react";

interface NavItem {
  to: string;
  matchPrefixes: string[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: "/partner/opportunities",
    matchPrefixes: ["/partner/opportunities", "/partner/dossier"],
    label: "Opportunity Market",
    icon: LayoutGrid,
  },
];

const TAB_CLASSES = [
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5",
  "text-sm font-medium transition-colors",
  "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  "text-muted-foreground hover:text-foreground hover:bg-card/60",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
].join(" ");

export function PartnerPortalNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Partner portal"
      className="flex w-full flex-wrap items-center gap-1 bg-muted/50 p-1 rounded-xl"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.matchPrefixes.some(
          (prefix) =>
            location.pathname === prefix ||
            location.pathname.startsWith(`${prefix}/`),
        );
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            data-state={isActive ? "active" : "inactive"}
            aria-current={isActive ? "page" : undefined}
            className={TAB_CLASSES}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      <a
        href="mailto:partners@windowman.pro"
        className={`${TAB_CLASSES} ml-auto`}
        data-state="inactive"
      >
        <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate">Support</span>
      </a>
    </nav>
  );
}
