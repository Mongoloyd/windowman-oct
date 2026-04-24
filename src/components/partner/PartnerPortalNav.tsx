/**
 * PartnerPortalNav — primary nav strip for the partner portal.
 *
 * Layout:
 *   [ Opportunity Market ]              ........  [ Support ] [ Sign Out ]
 *
 * Multi-tenant note: there are NO client/tenant IDs in any of these URLs.
 * Partner scoping is enforced server-side via RLS keyed on auth.uid().
 *
 * Dossier is intentionally NOT a primary nav item — it's a child detail
 * view reached from the Opportunity Market. Its active state is folded
 * into the Opportunity Market tab via `matchPrefixes`.
 */

import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, LifeBuoy, LogOut, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  {
    to: "/partner/revenue",
    matchPrefixes: ["/partner/revenue"],
    label: "Revenue",
    icon: TrendingUp,
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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[PartnerPortalNav] signOut error:", err);
      toast.error("Sign out failed. Please try again.");
      return;
    }
    // Hard nav so all in-memory partner state (queries, contexts) is dropped.
    window.location.href = "/partner/login";
  };

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

      {/* Right-aligned utility cluster */}
      <div className="ml-auto flex items-center gap-1">
        <a
          href="mailto:partners@windowman.pro"
          className={TAB_CLASSES}
          data-state="inactive"
        >
          <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
          <span className="truncate">Support</span>
        </a>
        <button
          type="button"
          onClick={handleSignOut}
          className={TAB_CLASSES}
          data-state="inactive"
          aria-label="Sign out of partner portal"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          <span className="truncate">Sign Out</span>
        </button>
      </div>
    </nav>
  );
}
