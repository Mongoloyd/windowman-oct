import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./nextdoor-dynamic-background.css";

type NextdoorDynamicBackgroundProps = {
  children: ReactNode;
  className?: string;
  intensity?: "soft" | "medium";
};

export function NextdoorDynamicBackground({
  children,
  className,
  intensity = "soft",
}: NextdoorDynamicBackgroundProps) {
  return (
    <div
      className={cn(
        "relative isolate min-h-screen overflow-x-hidden bg-[#f8fbff]",
        intensity === "medium" ? "nextdoor-bg-medium" : "nextdoor-bg-soft",
        className,
      )}
    >
      <div aria-hidden="true" className="nextdoor-bg-base" />
      <div aria-hidden="true" className="nextdoor-glass-field" />
      <div aria-hidden="true" className="nextdoor-blueprint-grid" />
      <div aria-hidden="true" className="nextdoor-scan-beam" />
      <div aria-hidden="true" className="nextdoor-center-wash" />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
