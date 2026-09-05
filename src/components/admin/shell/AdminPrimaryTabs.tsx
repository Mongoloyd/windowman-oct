/**
 * AdminPrimaryTabs — local Command Center panel navigation.
 *
 * Global destinations live in AdminGlobalNav. This control only switches
 * in-memory Command Center panels and must look quieter than global nav.
 */

import {
  ADMIN_DASHBOARD_TABS,
  ADMIN_SURFACE_LABELS,
  getAdminLocalPanelDisplayLabel,
  type AdminDashboardTab,
  type AdminSurfaceLabel,
} from "@/routes/adminDashboardTabs";

export interface AdminPrimaryTabsProps {
  ghostCount?: number;
  needsReviewCount?: number;
  activePanel?: string;
  onPanelChange?: (value: string) => void;
}

const CATEGORY_ORDER: AdminSurfaceLabel[] = [
  "Live",
  "Diagnostic",
  "Needs Runtime",
  "Playbook",
  "Static",
];

function groupedPanels(): Array<{ category: AdminSurfaceLabel; tabs: AdminDashboardTab[] }> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    tabs: ADMIN_DASHBOARD_TABS.filter((tab) => ADMIN_SURFACE_LABELS[tab] === category),
  })).filter((group) => group.tabs.length > 0);
}

export function AdminPrimaryTabs({
  activePanel = "mission-control",
  onPanelChange,
}: AdminPrimaryTabsProps) {
  const groups = groupedPanels();

  return (
    <nav aria-label="Command Center panels" className="wm-admin-local-nav">
      <label className="flex min-h-[44px] flex-wrap items-center gap-2 text-sm font-semibold text-slate-300">
        <span>Panel</span>
        <select
          aria-label="Command Center panels"
          value={activePanel}
          onChange={(event) => onPanelChange?.(event.target.value)}
          className="min-h-[44px] rounded-md border border-slate-400 bg-slate-100 px-3 text-sm font-semibold text-slate-900 shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          {groups.map((group) => (
            <optgroup key={group.category} label={group.category}>
              {group.tabs.map((tab) => (
                <option key={tab} value={tab}>
                  {getAdminLocalPanelDisplayLabel(tab)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </nav>
  );
}
