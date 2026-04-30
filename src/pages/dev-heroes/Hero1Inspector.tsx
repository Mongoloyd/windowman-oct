/**
 * Hero variant #1 — "Inspector Reveal"
 * WindowMan stands on the right with a continuous blue scan-line sweeping
 * over him. Headline + CTAs sit on the left, with a live-feel ticker.
 * Pure presentational prototype — no backend, no real CTAs wired.
 */
import wman from "@/assets/wman_phone_hero.avif";
import HeroShell from "./HeroShell";

export default function Hero1Inspector() {
  return (
    <HeroShell active="/dev/hero-1">
      <style>{`
        @keyframes wm-scan { 0% { top: 0; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        .wm-scan-line {
          position: absolute; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, transparent, #2563eb, transparent);
          box-shadow: 0 0 18px 4px rgba(37,99,235,0.55);
          animation: wm-scan 4s linear infinite;
        }
        @keyframes wm-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .wm-pulse-dot { animation: wm-pulse 1.4s ease-in-out infinite; }
      `}</style>

      <section className="relative min-h-[calc(100vh-44px)] overflow-hidden bg-gradient-to-br from-[#0a0e1a] via-[#0f172a] to-[#0a1628]">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono mb-6">
              <span className="wm-pulse-dot w-2 h-2 rounded-full bg-blue-400" />
              LIVE · analyzing 47 quotes right now
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              I'm <span className="text-blue-400">WindowMan</span>.
              <br />
              I read your quote
              <br />
              so you don't get robbed.
            </h1>
            <p className="mt-6 text-lg text-slate-400 max-w-md">
              Upload your contractor quote. In under 2 minutes I'll expose
              every overcharge, missing spec, and red flag.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button className="px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-bold text-white shadow-[0_0_30px_rgba(37,99,235,0.4)]">
                Upload My Quote →
              </button>
              <button className="px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 transition font-bold text-white">
                I Need a Quote
              </button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 font-mono">
              <span>🛡️ $12,400+ exposed last month</span>
              <span>⭐ 4.9/5 · 1,200+ homeowners</span>
            </div>
          </div>

          <div className="relative h-[520px] md:h-[640px] flex items-end justify-center">
            <div className="relative w-full h-full overflow-hidden">
              <img
                src={wman}
                alt="WindowMan inspecting a quote"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-full w-auto object-contain drop-shadow-[0_20px_50px_rgba(37,99,235,0.35)]"
              />
              <div className="wm-scan-line" />
            </div>
            <div className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-black/60 backdrop-blur border border-blue-500/40 font-mono text-xs">
              <div className="text-blue-300">SCAN ACTIVE</div>
              <div className="text-white/70">37 signals · 5 pillars</div>
            </div>
          </div>
        </div>
      </section>
    </HeroShell>
  );
}
