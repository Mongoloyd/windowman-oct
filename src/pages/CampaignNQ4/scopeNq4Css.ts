import { useEffect } from "react";
import nq4Css from "./nq4-landing.css?raw";

export const NQ4_STYLE_ELEMENT_ID = "nq4-landing-scoped-css";
export const NQ4_ROOT_CLASS = "nq4-root";
export const NQ4_ROBOTS_META_ID = "nq4-robots-meta";

let mountCount = 0;

function attachNq4Css(): void {
  mountCount += 1;

  if (typeof document === "undefined") return;
  if (document.getElementById(NQ4_STYLE_ELEMENT_ID)) return;

  const style = document.createElement("style");
  style.id = NQ4_STYLE_ELEMENT_ID;
  style.setAttribute("data-scope", NQ4_ROOT_CLASS);
  style.textContent = nq4Css;
  document.head.appendChild(style);
}

function detachNq4Css(): void {
  mountCount = Math.max(0, mountCount - 1);

  if (mountCount > 0 || typeof document === "undefined") return;
  document.getElementById(NQ4_STYLE_ELEMENT_ID)?.remove();
}

export function useNq4ScopedCss(): void {
  useEffect(() => {
    attachNq4Css();
    return detachNq4Css;
  }, []);
}

export function useNq4NoIndex(): void {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const existing = document.getElementById(NQ4_ROBOTS_META_ID);
    if (existing) return;

    const meta = document.createElement("meta");
    meta.id = NQ4_ROBOTS_META_ID;
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);

    return () => {
      document.getElementById(NQ4_ROBOTS_META_ID)?.remove();
    };
  }, []);
}

export function __resetNq4DocumentStateForTests(): void {
  mountCount = 0;
  if (typeof document === "undefined") return;
  document.getElementById(NQ4_STYLE_ELEMENT_ID)?.remove();
  document.getElementById(NQ4_ROBOTS_META_ID)?.remove();
}
