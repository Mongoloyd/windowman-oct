/**
 * Shared dev-harness shell for hero prototypes. Provides a top bar with
 * quick-jump links between /dev/hero-1, /dev/hero-3, /dev/hero-4 so they
 * can be A/B compared in the same browser tab.
 */
import { Link } from "react-router-dom";
import { ReactNode } from "react";

const VARIANTS = [
  { path: "/dev/hero-1", label: "1 · Inspector Reveal" },
  { path: "/dev/hero-3", label: "3 · Phone-as-Portal" },
  { path: "/dev/hero-4", label: "4 · Floating Receipts" },
];

export default function HeroShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-50 flex flex-wrap items-center gap-2 bg-black/80 backdrop-blur border-b border-white/10 px-4 py-2 text-xs">
        <span className="font-mono text-white/40 mr-2">DEV · hero compare</span>
        {VARIANTS.map((v) => (
          <Link
            key={v.path}
            to={v.path}
            className={`px-3 py-1.5 rounded-md font-mono transition-colors ${
              active === v.path
                ? "bg-white text-black"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
