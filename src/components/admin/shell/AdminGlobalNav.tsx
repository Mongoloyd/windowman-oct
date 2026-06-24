/**
 * AdminGlobalNav — persistent, links-only operator navigation.
 *
 * Renders a compact, horizontally-scrollable strip of <NavLink>s to the key
 * /admin destinations so every AdminShell page is one click from the rest of
 * the workspace.
 *
 * Design contract:
 * - Links only. No Radix Tabs / TabsList / TabsTrigger dependency (unlike
 *   AdminPrimaryTabs, which is bound to the dashboard <Tabs> context).
 * - No backend calls, no auth logic, no persisted state.
 * - Active state is derived by react-router. NavLink (`end={false}`) keeps a
 *   section highlighted on nested routes, e.g. "Lead Inbox" stays active on
 *   /admin/leads/:id and /admin/leads/:id/report.
 *
 * Every route below is verified to exist in src/routes/AdminRoutes.tsx.
 */

import { NavLink } from "react-router-dom";
import {
  Activity,
  BarChart3,
  FileSearch,
  GitBranch,
  Handshake,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  ListChecks,
  PhoneCall,
  Settings,
  Users,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  /**
   * When true, only match the exact path (no nested-route highlighting).
   * Used to keep specific routes from over-matching siblings.
   */
  end?: boolean;
}

// Curated operator destinations. Order = importance for daily triage flow.
const NAV_ITEMS: NavItem[] = [
  { to: "/admin/leads", label: "Lead Inbox", icon: Inbox },
  { to: "/admin/command-center", label: "Command Center", icon: LayoutDashboard },
  { to: "/admin/pipeline", label: "Pipeline", icon: GitBranch },
  { to: "/admin/routing", label: "Routing", icon: GitBranch },
  { to: "/admin/needs-review", label: "Needs Review", icon: ListChecks },
  { to: "/admin/contractors", label: "Contractors", icon: Users },
  { to: "/admin/attribution", label: "Attribution", icon: BarChart3 },
  { to: "/admin/otp-ops", label: "OTP Ops", icon: PhoneCall },
  { to: "/admin/lead-evidence", label: "Evidence", icon: FileSearch },
  { to: "/admin/partners", label: "Partners", icon: Handshake },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/health", label: "Health", icon: HeartPulse },
];

const BASE_LINK_CLASSES = [
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg",
  "border px-3 py-1 text-sm font-bold transition-colors",
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2",
].join(" ");

const INACTIVE_CLASSES =
  "border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-white hover:text-slate-950";

const ACTIVE_CLASSES =
  "border-slate-400 bg-white text-slate-950 font-black shadow-sm";

export function AdminGlobalNav() {
  return (
    <nav aria-label="Admin sections">
      <div className="wm-slim-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-300 bg-white p-2 shadow-sm [scrollbar-gutter:stable]">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `${BASE_LINK_CLASSES} ${isActive ? ACTIVE_CLASSES : INACTIVE_CLASSES}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
                {isActive && <span className="sr-only"> (current section)</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
