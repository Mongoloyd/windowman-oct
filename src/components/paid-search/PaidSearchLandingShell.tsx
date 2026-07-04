import type { ReactNode } from "react";

/** Shared visual tokens — Contractors3 system font + white-opacity contrast ladder. */
export const paidSearchLabelClass =
  "mb-1.5 block text-xs font-bold uppercase tracking-widest text-white/70";

export const paidSearchInputClass =
  "w-full rounded-lg border border-white/15 bg-[#0B1728] px-4 py-3 text-white placeholder-white/40 outline-none transition focus:border-[#49A5FF] focus:ring-2 focus:ring-[#49A5FF]/30";

export const paidSearchPrimaryButtonClass =
  "rounded-lg bg-[#49A5FF] px-6 py-3.5 text-base font-bold text-[#0F1F35] transition hover:bg-[#6BB6FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

export const paidSearchTrustPillClass =
  "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80";

export const paidSearchEyebrowClass =
  "text-xs font-bold uppercase tracking-widest text-[#49A5FF]";

export const paidSearchSectionTitleClass =
  "text-3xl font-extrabold tracking-tight text-white sm:text-4xl";

export function PaidSearchLandingHeader() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="text-xl font-bold tracking-tight text-white">
          WINDOW<span className="text-[#49A5FF]">MAN</span>
        </span>
        <span className="rounded-full border border-[#C8952A]/40 bg-[#C8952A]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#C8952A]">
          Independent · Not a contractor
        </span>
      </div>
    </header>
  );
}

interface PaidSearchLandingShellProps {
  children: ReactNode;
  /** Narrow pages (window-prices) can cap header width via inner sections. */
  mainClassName?: string;
}

export function PaidSearchLandingShell({
  children,
  mainClassName = "",
}: PaidSearchLandingShellProps) {
  return (
    <main
      className={`contractors3-page flex min-h-screen flex-col bg-[#0F1F35] text-white antialiased ${mainClassName}`}
    >
      {children}
    </main>
  );
}

interface PaidSearchLandingFooterProps {
  year: number;
  children: ReactNode;
  extraLinks?: ReactNode;
}

export function PaidSearchLandingFooter({
  year,
  children,
  extraLinks,
}: PaidSearchLandingFooterProps) {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <p className="text-xs leading-relaxed text-white/50">{children}</p>
        <p className="mt-3 text-xs text-white/50">
          © {year} WindowMan ·{" "}
          <a
            href="/privacy"
            className="underline-offset-2 hover:text-white/70 hover:underline"
          >
            Privacy
          </a>{" "}
          ·{" "}
          <a
            href="/terms"
            className="underline-offset-2 hover:text-white/70 hover:underline"
          >
            Terms
          </a>
          {extraLinks}
        </p>
      </div>
    </footer>
  );
}
