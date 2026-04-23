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
  belowHeader,
  fullBleed = false,
  children,
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              {backTo && (
                <Link
                  to={backTo}
                  className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {backLabel}
                </Link>
              )}
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </p>
              <h1 className="mt-1 font-display text-2xl md:text-3xl font-extrabold leading-tight tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div className="shrink-0">
              <AdminIdentityBar />
            </div>
          </div>
          {belowHeader && <div className="mt-4">{belowHeader}</div>}
        </div>
      </header>

      <main
        className={
          fullBleed
            ? "w-full"
            : "w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6"
        }
      >
        {children}
      </main>
    </div>
  );
}
