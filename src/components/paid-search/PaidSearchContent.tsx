import type { ReactNode } from "react";
import {
  paidSearchEyebrowClass,
  paidSearchSectionTitleClass,
} from "@/components/paid-search/PaidSearchLandingShell";

/**
 * Reusable content primitives shared by the paid-search lead-magnet pages
 * (window-price-audit / truth-report / ai-demo). Visual-only; no data logic.
 */

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
  tint?: boolean; // darker band for rhythm
}

export function PaidSearchSection({
  id,
  eyebrow,
  title,
  children,
  className = "",
  tint = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`${tint ? "border-y border-white/10 bg-[#0B1728]" : ""} ${className}`}
    >
      <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
        {eyebrow && <p className={paidSearchEyebrowClass}>{eyebrow}</p>}
        {title && (
          <h2 className={`${title && eyebrow ? "mt-2" : ""} ${paidSearchSectionTitleClass}`}>
            {title}
          </h2>
        )}
        <div className={eyebrow || title ? "mt-6" : ""}>{children}</div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  code?: string;
  title: string;
  children: ReactNode;
}

export function PaidSearchFeatureCard({ code, title, children }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#49A5FF]/40">
      <div className="flex items-center gap-3">
        {code && (
          <span className="rounded-md border border-[#49A5FF]/40 bg-[#49A5FF]/10 px-2 py-0.5 text-xs font-bold text-[#49A5FF]">
            {code}
          </span>
        )}
        <h3 className="text-xl font-bold text-white">{title}</h3>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-white/70">{children}</div>
    </div>
  );
}

interface CheckItemProps {
  children: ReactNode;
}

export function PaidSearchCheckItem({ children }: CheckItemProps) {
  return (
    <li className="flex gap-3 text-white/80">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-[#49A5FF]/40 bg-[#49A5FF]/10 text-[11px] font-bold text-[#49A5FF]"
      >
        ✓
      </span>
      <span className="text-sm leading-relaxed">{children}</span>
    </li>
  );
}
