/**
 * DevTesting1 — DEV-only harness for the Dark Forensic Dossier theme.
 * Route: /dev/testing1 (gated by import.meta.env.DEV in App.tsx)
 *
 * Does not call edge functions, does not hit Supabase, does not run OTP.
 * Pure presentation harness with a preview/full toggle.
 */

import { useState } from "react";
import { DarkForensicDossier } from "@/components/dossier-dark/DarkForensicDossier";
import { SAMPLE_DOSSIER } from "@/components/dossier-dark/fixtures";

export default function DevTesting1() {
  const [accessLevel, setAccessLevel] = useState<"preview" | "full">("preview");

  return (
    <div className="bg-dossier-surface">
      {/* Dev toggle bar */}
      <div className="sticky top-0 z-50 bg-dossier-elevated/95 backdrop-blur border-b border-dossier-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-dossier-accent font-semibold">
              Dev Harness
            </span>
            <span className="text-xs text-dossier-txt-muted font-mono">/dev/testing1</span>
          </div>
          <div
            role="tablist"
            aria-label="Access level"
            className="inline-flex rounded-lg border border-dossier-border bg-dossier-surface p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={accessLevel === "preview"}
              onClick={() => setAccessLevel("preview")}
              className={`min-h-[44px] px-4 text-sm font-semibold rounded-md transition-colors ${
                accessLevel === "preview"
                  ? "bg-dossier-accent text-white"
                  : "text-dossier-txt-secondary hover:text-dossier-txt-primary"
              }`}
            >
              Preview (locked)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={accessLevel === "full"}
              onClick={() => setAccessLevel("full")}
              className={`min-h-[44px] px-4 text-sm font-semibold rounded-md transition-colors ${
                accessLevel === "full"
                  ? "bg-dossier-accent text-white"
                  : "text-dossier-txt-secondary hover:text-dossier-txt-primary"
              }`}
            >
              Full (verified)
            </button>
          </div>
        </div>
      </div>

      <DarkForensicDossier data={SAMPLE_DOSSIER} accessLevel={accessLevel} />
    </div>
  );
}
