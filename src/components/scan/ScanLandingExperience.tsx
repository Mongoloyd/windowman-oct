/**
 * ScanLandingExperience — Sprint 1 visual foundation for the `/scan` route.
 *
 * Static landing page only: hero, flow card, upload surface, value band, and
 * footer. Nothing here reads a file, calls Supabase, Gemini, an Edge Function,
 * or tracking. Upload custody, analysis, lead capture, and reporting are
 * later-sprint work behind their own approvals.
 */

import { useRef } from "react";
import ScanHero from "./ScanHero";
import ScanUploadSurface, { SCAN_UPLOAD_SECTION_ID } from "./ScanUploadSurface";

const VALUE_BAND_BACKGROUND =
  "linear-gradient(180deg, hsl(213 58% 14%) 0%, hsl(213 62% 11%) 100%)";

export default function ScanLandingExperience() {
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function handleGetReview() {
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    document.getElementById(SCAN_UPLOAD_SECTION_ID)?.scrollIntoView?.({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });

    uploadInputRef.current?.focus({ preventScroll: true });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <ScanHero onGetReview={handleGetReview} />

      <ScanUploadSurface ref={uploadInputRef} />

      <section
        aria-labelledby="scan-value-band-heading"
        className="px-4 py-12 text-center sm:px-6 lg:py-14"
        style={{ background: VALUE_BAND_BACKGROUND }}
      >
        <h2
          id="scan-value-band-heading"
          className="mx-auto max-w-3xl text-2xl font-extrabold uppercase leading-[1.15] tracking-tight text-white sm:text-3xl lg:text-4xl"
        >
          Free. Instant. Unbiased.
          <span className="mt-1 block text-primary">No-strings attached.</span>
        </h2>
        <p className="mt-4 text-sm text-white/70">WindowMan AI Quote Review</p>
      </section>

      <footer className="bg-muted px-4 py-10 sm:px-6">
        <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted-foreground">
          WindowMan is an independent quote-review service. We are not the contractor or
          installer. The review is informational and highlights items homeowners may wish to
          discuss with a licensed professional.
        </p>
      </footer>
    </main>
  );
}
