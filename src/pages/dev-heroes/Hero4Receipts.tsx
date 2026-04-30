/**
 * Hero variant #4 — "Floating Receipts"
 * WindowMan at center; quote thumbnails orbit around him with red-flag /
 * green-flag stickers. Pure presentational prototype.
 */
import { useNavigate } from "react-router-dom";
import wman from "@/assets/wman_phone_hero.avif";
import HeroShell from "./HeroShell";

const RECEIPTS = [
  { tag: "OVERCHARGE +$2,400", tone: "danger", x: "8%", y: "18%", rot: -8, delay: 0 },
  { tag: "MISSING DP RATING", tone: "danger", x: "78%", y: "12%", rot: 6, delay: 0.6 },
  { tag: "FAIR PRICE", tone: "ok", x: "4%", y: "62%", rot: 4, delay: 1.1 },
  { tag: "WARRANTY UNCLEAR", tone: "warn", x: "82%", y: "58%", rot: -5, delay: 1.6 },
  { tag: "PERMIT NOT INCLUDED", tone: "danger", x: "70%", y: "78%", rot: 9, delay: 2.1 },
  { tag: "CODE COMPLIANT", tone: "ok", x: "12%", y: "82%", rot: -6, delay: 2.6 },
];

export default function Hero4Receipts() {
  const navigate = useNavigate();
  const startUpload = () =>
    navigate("/?cta=hero_dev4#truth-gate");
  return (
    <HeroShell active="/dev/hero-4">
      <style>{`
        @keyframes wm-float {
          0%, 100% { transform: translateY(0) rotate(var(--r,0deg)); }
          50% { transform: translateY(-14px) rotate(calc(var(--r,0deg) + 2deg)); }
        }
        .wm-receipt { animation: wm-float 6s ease-in-out infinite; }
      `}</style>

      <section className="relative min-h-[calc(100vh-44px)] overflow-hidden bg-[radial-gradient(ellipse_at_center,#1a1530_0%,#06060f_70%)]">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full border border-white/5 pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-6 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            Every quote tells a story.
            <br />
            <span className="text-blue-400">I read between the lines.</span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-400 max-w-xl mx-auto">
            Drop your contractor quote. Watch WindowMan flag every
            overcharge, missing spec, and shady clause.
          </p>
        </div>

        <div className="relative h-[560px] mx-auto max-w-5xl">
          <img
            src={wman}
            alt="WindowMan surrounded by analyzed quotes"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 h-full w-auto object-contain drop-shadow-[0_30px_60px_rgba(37,99,235,0.35)] z-10"
          />

          {RECEIPTS.map((r, i) => {
            const palette =
              r.tone === "danger"
                ? "bg-red-500 text-white border-red-300"
                : r.tone === "ok"
                ? "bg-emerald-500 text-white border-emerald-300"
                : "bg-amber-500 text-black border-amber-300";
            return (
              <div
                key={i}
                className="wm-receipt absolute z-20"
                style={
                  {
                    left: r.x,
                    top: r.y,
                    "--r": `${r.rot}deg`,
                    animationDelay: `${r.delay}s`,
                  } as React.CSSProperties
                }
              >
                <div className="w-[150px] bg-white rounded-md shadow-2xl p-2">
                  <div className="h-16 bg-slate-100 rounded-sm mb-1.5 flex flex-col gap-1 p-1.5">
                    <div className="h-1 bg-slate-300 rounded w-3/4" />
                    <div className="h-1 bg-slate-300 rounded w-1/2" />
                    <div className="h-1 bg-slate-300 rounded w-2/3" />
                    <div className="h-1 bg-slate-300 rounded w-1/3" />
                  </div>
                  <div
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-1 rounded border ${palette} text-center`}
                  >
                    {r.tag}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative z-10 text-center pb-10">
          <button className="px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-bold text-white shadow-[0_0_40px_rgba(37,99,235,0.5)]">
            Upload My Quote →
          </button>
          <p className="mt-3 text-xs text-slate-500 font-mono">
            Average homeowner saves $3,800 · 4.9/5 from 1,200+ reviews
          </p>
        </div>
      </section>
    </HeroShell>
  );
}
