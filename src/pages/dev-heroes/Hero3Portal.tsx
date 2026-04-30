/**
 * Hero variant #3 — "Phone-as-Portal"
 * WindowMan holds a phone whose screen renders a live mini Truth Report card
 * (real DOM, not an image) showing a B+ grade and red-flag count.
 * Pure presentational prototype.
 */
import wman from "@/assets/wman_phone_hero.avif";
import HeroShell from "./HeroShell";

export default function Hero3Portal() {
  return (
    <HeroShell active="/dev/hero-3">
      <section className="relative min-h-[calc(100vh-44px)] overflow-hidden bg-gradient-to-b from-[#06080f] to-[#0a1428]">
        <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 grid md:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono mb-5">
              CARFAX FOR WINDOW QUOTES
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              See the Truth Report
              <br />
              <span className="text-blue-400">before you sign.</span>
            </h1>
            <p className="mt-6 text-lg text-slate-400 max-w-md">
              I scan the contract. You see the grade. The phone in my hand
              is exactly what you'll get — a forensic dossier of every
              quote, scored on 37 signals.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button className="px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-bold text-white">
                Get My Truth Report →
              </button>
              <button className="px-6 py-4 rounded-xl bg-transparent hover:bg-white/5 border border-white/20 transition font-bold text-white">
                See a Sample
              </button>
            </div>
          </div>

          <div className="relative h-[560px] md:h-[680px]">
            <img
              src={wman}
              alt="WindowMan holding a Truth Report"
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-full w-auto object-contain"
            />

            <div className="absolute top-6 right-0 md:right-4 w-[280px] rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 shadow-2xl shadow-blue-500/20 p-5 rotate-[-4deg] hover:rotate-0 transition-transform duration-300">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Truth Report
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  ● VERIFIED
                </span>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-800 ring-4 ring-blue-500/30 flex items-center justify-center text-3xl font-black text-white">
                  B+
                </div>
                <div>
                  <div className="text-xs text-slate-500">Overall Grade</div>
                  <div className="text-sm text-white font-semibold">
                    Above average
                  </div>
                  <div className="text-xs text-slate-400">
                    Confidence 92%
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Safety & Code", val: "A−", color: "text-emerald-400" },
                  { label: "Price Fairness", val: "B", color: "text-blue-400" },
                  { label: "Fine Print", val: "C+", color: "text-amber-400" },
                  { label: "Warranty", val: "B+", color: "text-blue-400" },
                ].map((p) => (
                  <div
                    key={p.label}
                    className="flex justify-between text-xs border-b border-white/5 pb-1.5"
                  >
                    <span className="text-slate-400">{p.label}</span>
                    <span className={`${p.color} font-bold font-mono`}>
                      {p.val}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-red-400 font-semibold">
                  ⚠ 3 red flags
                </span>
                <span className="text-xs text-emerald-400 font-semibold">
                  Save ~$3,800
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </HeroShell>
  );
}
