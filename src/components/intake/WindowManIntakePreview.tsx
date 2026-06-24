import { Helmet } from "react-helmet-async";
import { Shield } from "lucide-react";
import { WindowManIntakeRouter } from "./WindowManIntakeRouter";
import { PREVIEW_LAB_BANNER } from "./intakeCopy";

/**
 * Visual lab preview — simulates a lighter WindowMan page with intake modal popup.
 * Dark modal over branded/blurred page context (design direction lock: Sprint C.2A).
 */
export function WindowManIntakePreview() {
  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex,nofollow" />
        <title>Intake Preview · WindowMan Visual Lab</title>
      </Helmet>

      <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-gradient-to-br from-slate-100 via-[#e8eef5] to-[#c5d4e8] text-slate-900">
        {/* Branded page diagonal pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(15,40,90,0.06) 0px, rgba(15,40,90,0.06) 1px, transparent 1px, transparent 18px)",
          }}
          aria-hidden
        />

        {/* Simulated page content (blurred, behind modal) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="mx-auto max-w-4xl px-6 pt-16 sm:pt-24">
            <div className="flex items-center gap-2 text-[#0f285a]/70">
              <Shield className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-[0.2em]">WindowMan</span>
            </div>
            <div className="mt-6 h-10 w-[min(90%,520px)] rounded-lg bg-white/50 blur-[1px]" />
            <div className="mt-3 h-6 w-[min(70%,380px)] rounded-md bg-white/40 blur-[1px]" />
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="h-32 rounded-2xl border border-white/60 bg-white/45 shadow-sm blur-[2px]" />
              <div className="h-32 rounded-2xl border border-white/60 bg-white/45 shadow-sm blur-[2px]" />
            </div>
            <div className="mt-6 h-24 rounded-2xl border border-white/50 bg-[#0f285a]/8 blur-[3px]" />
          </div>
        </div>

        {/* Faint mullion on page layer */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,40,90,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(15,40,90,0.4) 1px, transparent 1px)",
            backgroundSize: "80px 100px",
            backgroundPosition: "center top",
          }}
          aria-hidden
        />

        {/* Dim + blur overlay — modal focus layer */}
        <div
          className="pointer-events-none absolute inset-0 bg-[#0f285a]/45 backdrop-blur-[3px]"
          aria-hidden
        />

        {/* Concierge stage —
            desktop/tablet: centered frosted dossier glass over the blurred page;
            mobile: full-bleed 100dvh application layer (router goes edge-to-edge). */}
        <div className="relative z-10 flex min-h-[100dvh] items-stretch justify-center sm:items-start sm:overflow-y-auto sm:px-6 sm:py-10">
          <div className="flex w-full flex-col sm:max-w-md">
            <p
              className="hidden text-center text-[10px] font-bold uppercase tracking-[0.22em] text-white/80 drop-shadow-sm sm:mb-4 sm:block"
              role="note"
            >
              {PREVIEW_LAB_BANNER}
            </p>

            <WindowManIntakeRouter defaultOpen />
          </div>
        </div>
      </div>
    </>
  );
}

export default WindowManIntakePreview;
