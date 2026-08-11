/**
 * AdminShell — Shared chrome for every /admin/* page.
 *
 * Provides:
 * - sticky top header with eyebrow + display title + subtitle
 * - identity bar (email, role, sign out) on the right
 * - optional back-link slot
 * - consistent max-width content container
 *
 * Pages compose: <AdminShell title="…" subtitle="…">{content}</AdminShell>
 */

import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AdminIdentityBar } from "./AdminIdentityBar";

interface AdminShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  /**
   * Optional persistent global navigation (e.g. <AdminGlobalNav />), rendered
   * directly below the header/identity row and above `belowHeader`. When
   * undefined, the header layout is unchanged.
   */
  nav?: ReactNode;
  /** Optional element rendered between header and content (tabs, filters, …). */
  belowHeader?: ReactNode;
  /** Whether the content area gets the standard max-width container.  */
  fullBleed?: boolean;
  children: ReactNode;
}

export function AdminShell({
  eyebrow = "Admin",
  title,
  subtitle,
  backTo,
  backLabel = "Back to dashboard",
  nav,
  belowHeader,
  fullBleed = false,
  children,
}: AdminShellProps) {
  return (
    <div className="wm-dashboard-surface wm-admin-canvas min-h-screen">
      <header className="wm-admin-chrome sticky top-0 z-30 border-b shadow-sm backdrop-blur">
        <div className="w-full px-4 py-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              {backTo && (
                <Link
                  to={backTo}
                  className="mb-2 inline-flex min-h-10 items-center gap-1.5 rounded text-sm font-bold text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {backLabel}
                </Link>
              )}
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-300">
                {eyebrow}
              </p>
              <h1 className="mt-0.5 font-display text-3xl md:text-4xl font-black leading-tight tracking-tight text-white">
                {title}
              </h1>
              {subtitle && <p className="mt-0.5 text-base font-bold text-slate-300">{subtitle}</p>}
            </div>
            <div className="shrink-0">
              <AdminIdentityBar />
            </div>
          </div>
          {nav && <div className="mt-4">{nav}</div>}
          {belowHeader && <div className="mt-4">{belowHeader}</div>}
        </div>
      </header>

      <main
        className={
          fullBleed
            ? "w-full"
            : "w-full px-4 py-5 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
        }
      >
        {children}
      </main>
    </div>
  );
}
