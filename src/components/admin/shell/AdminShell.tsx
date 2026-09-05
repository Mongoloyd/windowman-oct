/**
 * AdminShell — Shared chrome for every authenticated /admin/* page.
 *
 * Target composition:
 *   authenticated command bar (logo, navigation slot, account)
 *   route-aware page header (title, subtitle, contextual actions)
 *   optional local navigation (`belowHeader`)
 *   main content
 *
 * Pages compose: <AdminShell title="…" subtitle="…">{content}</AdminShell>
 */

import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { AdminIdentityBar } from "./AdminIdentityBar";

interface AdminShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  /**
   * Optional persistent global navigation (e.g. <AdminGlobalNav />), rendered
   * in the authenticated command bar. When undefined, the nav slot is empty.
   */
  nav?: ReactNode;
  /**
   * @deprecated Inbox-only command-bar search slot. The unified shell ignores
   * this prop so later Inbox integration can remove the duplicate search.
   */
  leadInboxHeaderTools?: ReactNode;
  /** Contextual actions in the route-aware page header. */
  headerActions?: ReactNode;
  /** Optional element rendered between page header and content (local nav). */
  belowHeader?: ReactNode;
  /** Whether the content area gets the standard max-width container.  */
  fullBleed?: boolean;
  /** Opt-in page treatment. Defaults preserve every existing admin surface. */
  variant?: "default" | "lead-dossier" | "lead-inbox";
  children: ReactNode;
}

const CHROME_FOCUS_CLASSES =
  "rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2";

export function AdminShell({
  eyebrow = "Admin",
  title,
  subtitle,
  backTo,
  backLabel = "Back to dashboard",
  nav,
  leadInboxHeaderTools: _ignoredInboxHeaderTools,
  headerActions,
  belowHeader,
  fullBleed = false,
  variant = "default",
  children,
}: AdminShellProps) {
  void _ignoredInboxHeaderTools;
  const isLeadDossier = variant === "lead-dossier";
  const isCompactChrome = variant === "lead-inbox" || variant === "default";

  useEffect(() => {
    document.title = `${title} · WindowMan Admin`;
  }, [title]);

  return (
    <div
      className={`wm-dashboard-surface wm-admin-canvas min-h-screen ${
        isLeadDossier ? "wm-lead-dossier" : ""
      }`}
    >
      <header className="wm-admin-chrome wm-admin-inbox-chrome sticky top-0 z-30 border-b shadow-sm backdrop-blur">
        <div
          className={
            isLeadDossier
              ? "w-full px-4 py-3 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
              : "w-full px-4 py-2.5 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
          }
        >
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo
              to="/admin/leads"
              useRouterLink
              size="md"
              ariaLabel="WindowMan Lead Inbox"
              className={`shrink-0 ${CHROME_FOCUS_CLASSES}`}
              wordmarkClassName="text-white"
            />
            {nav ? <div className="min-w-0 flex-1">{nav}</div> : null}
            <div className="shrink-0">
              <AdminIdentityBar />
            </div>
          </div>

          <div
            className={
              isLeadDossier
                ? "mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"
                : isCompactChrome
                  ? "mt-2.5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"
                  : "mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
            }
          >
            <div className="min-w-0">
              {backTo && (
                <Link
                  to={backTo}
                  className={`mb-1.5 inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-slate-300 transition-colors hover:text-white ${CHROME_FOCUS_CLASSES}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {backLabel}
                </Link>
              )}
              <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.16em] text-blue-300">
                {eyebrow}
              </p>
              <h1
                className={
                  isLeadDossier
                    ? "mt-0.5 font-display text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl"
                    : "mt-0.5 font-display text-2xl font-black leading-tight tracking-tight text-white md:text-3xl"
                }
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 text-sm font-bold text-slate-300 md:text-base">
                  {subtitle}
                </p>
              )}
            </div>
            {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
          </div>

          {belowHeader && <div className="mt-3">{belowHeader}</div>}
        </div>
      </header>

      <main
        className={
          fullBleed
            ? "w-full"
            : "wm-admin-directory w-full px-4 py-5 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
        }
      >
        {children}
      </main>
    </div>
  );
}
