interface Prediction {
  /** The line we expect to find, quoted the way it usually appears. */
  claim: string;
  /** Why it matters, in plain language. No accusation. */
  why: string;
  /** The exact sentence to say to the contractor. */
  ask: string;
}

const PREDICTIONS: readonly Prediction[] = [
  {
    claim: "One lump line that just says “Installation”.",
    why: "Labor, permits, disposal, stucco patching and trim work can all hide inside a single number — or be missing from it. You can't tell which from the outside.",
    ask: "“Can you itemize what's inside the installation line, and confirm whether permits and stucco repair are included?”",
  },
  {
    claim: "A glass package with a name but no specs.",
    why: "A series name isn't a specification. Design pressure rating, impact rating and the Florida product approval number are what actually determine what gets installed.",
    ask: "“Which exact series and glass package is this, and what's the Florida Product Approval or NOA number?”",
  },
  {
    claim: "A warranty mentioned but never defined.",
    why: "Manufacturer coverage and labor coverage are different things with different lengths. Transferability is usually the part nobody writes down.",
    ask: "“How long is labor covered versus the manufacturer warranty, and is either transferable if I sell?”",
  },
  {
    claim: "A price that expires if you don't sign today.",
    why: "A deadline is a negotiating position, not a cost. Deposit size and the payment schedule tell you far more about risk than the headline number does.",
    ask: "“What's the deposit, when is each payment due, and what work is complete at each milestone?”",
  },
];

/**
 * The proof of the campaign's claim. Each item names something we expect to
 * find, explains why it matters, and hands over the exact sentence to say.
 *
 * Tone: this section demonstrates foreknowledge, never accusation. Every
 * "why" describes an ambiguity in a document, not a person's intent — a
 * contractor who writes a clean estimate passes all four on sight.
 */
export default function ProphecyPredictions() {
  return (
    <section className="relative px-5 py-16 [content-visibility:auto] [contain-intrinsic-size:auto_720px] sm:px-8 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
          The prophecy
        </p>
        <h2 className="mt-3 max-w-[22ch] text-[28px] font-bold leading-[1.15] text-white sm:text-[36px]">
          We haven't seen your estimate. We can still tell you what's on it.
        </h2>
        <p className="mt-4 max-w-[62ch] text-[15.5px] leading-relaxed text-slate-400">
          Not because your contractor is doing anything wrong — because the
          whole industry writes estimates the same way. Here are four things
          we expect to find, and what to say about each one.
        </p>

        <ol className="mt-9 grid gap-4 sm:grid-cols-2">
          {PREDICTIONS.map((prediction, index) => (
            <li
              key={prediction.claim}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.055] to-white/[0.012] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-1px_0_rgba(0,0,0,0.5),0_20px_46px_-30px_rgba(0,0,0,0.9)] sm:p-6"
            >
              {/* Warm edge: unresolved, worth a look. Signal, not decoration. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent"
              />
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] font-bold text-amber-300/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[16.5px] font-semibold leading-snug text-white">
                  {prediction.claim}
                </h3>
              </div>

              <p className="mt-3 text-[14px] leading-relaxed text-slate-400">
                {prediction.why}
              </p>

              <p className="mt-4 border-l-2 border-cyan-300/45 py-1 pl-3.5 text-[14px] italic leading-relaxed text-cyan-100/85">
                {prediction.ask}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-[13.5px] leading-relaxed text-slate-400">
          Illustrative examples, not real estimates. A contractor still needs to
          measure, verify site conditions and provide the final construction
          agreement — WindowMan helps you understand the written estimate before
          you sign it.
        </p>
      </div>
    </section>
  );
}
