import { FileSearch, TrendingUp, UserCheck, Lock, Handshake, ShieldCheck } from "lucide-react";
import { ArbitrageFlowDiagram } from "@/components/diagnosis/ArbitrageFlowDiagram";

export function MarketingSections() {
  return (
    <>
      <section className="relative py-20 px-6" style={{ background: "transparent" }}>
        <div className="max-w-4xl mx-auto relative z-10">
          <h2 className="wm-title-section font-display text-3xl md:text-4xl text-center mb-12 text-foreground">
            How WindowMan Gets You a Better Quote
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card-raised rounded-2xl p-6 md:p-8">
              <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mb-4 flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    background: "hsl(0 79% 95%)",
                    color: "hsl(0 79% 43%)",
                    border: "1px solid hsl(0 79% 78%)",
                  }}
                >
                  ✕
                </span>
                When You Shop Alone
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-cobalt/60 mt-1">•</span>
                  <span className="text-foreground/80">Generic bids with no context about your quote problems.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cobalt/60 mt-1">•</span>
                  <span className="text-foreground/80">Contractors don't know what red flags to fix.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cobalt/60 mt-1">•</span>
                  <span className="text-foreground/80">You repeat the same comparison mistakes.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cobalt/60 mt-1">•</span>
                  <span className="text-foreground/80">You're alone when problems surface later.</span>
                </li>
              </ul>
            </div>

            <div className="card-raised rounded-2xl p-6 md:p-8">
              <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mb-4 flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{
                    background: "linear-gradient(180deg, hsl(160 75% 48%) 0%, hsl(160 84% 39%) 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
                  }}
                >
                  ✓
                </span>
                With WindowMan
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-cobalt mt-1">•</span>
                  <span className="text-foreground/80">
                    We share your findings upfront so our contractors know exactly what to fix.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cobalt mt-1">•</span>
                  <span className="text-foreground/80">Our quote database gives us real market leverage.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cobalt mt-1">•</span>
                  <span className="text-foreground/80">We negotiate scope, warranty, and price on your behalf.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cobalt mt-1">•</span>
                  <span className="text-foreground/80">We stay with you through installation and beyond.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12">
            <ArbitrageFlowDiagram />
          </div>

          <div className="mt-12 card-raised rounded-xl p-6 border-l-4" style={{ borderLeftColor: "hsl(217 91% 53%)" }}>
            <p className="text-foreground font-medium text-center">
              <strong>Bottom Line:</strong> You Don't Have Market Leverage. WindowMan Does. Our Quote Data is our Power,
              and we use it To Work For You.
            </p>
          </div>
        </div>
      </section>

      <section className="relative py-24 px-6 max-w-6xl mx-auto" style={{ background: "transparent" }}>
        <div className="text-center mb-16">
          <h2 className="wm-title-section font-display text-3xl md:text-4xl text-foreground">
            We Work for You, Like a Realtor.
          </h2>
          <p className="mt-4 text-lg text-foreground/75">Here's What That Actually Means.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[
            {
              Icon: FileSearch,
              title: "Market Intelligence",
              body: "Our proprietary database of thousands of audited quotes tells us what's fair, what's overpriced, and what scope gaps exist in your market.",
            },
            {
              Icon: TrendingUp,
              title: "Targeted Estimates",
              body: "We brief contractors on your audit findings. They know exactly what scope, materials, and warranties you need.",
            },
            {
              Icon: Handshake,
              title: "We Negotiate For You",
              body: "Your advisor reviews each quote against your audit findings and market benchmarks. We negotiate on your behalf.",
            },
            {
              Icon: UserCheck,
              title: "Ongoing Support",
              body: "We don't hand you off after the quote. Your advisor stays with you through the entire process.",
            },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="card-raised rounded-2xl p-6 md:p-7 flex gap-5">
              <div className="shrink-0 mt-1">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                  style={{
                    background: "linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(37,99,235,0.22)",
                  }}
                >
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h3 className="font-display text-xl font-extrabold tracking-tight text-foreground mb-2">{title}</h3>
                <p className="text-foreground/75 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative py-20 px-6" style={{ background: "transparent" }}>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="wm-title-section font-display text-3xl md:text-4xl mb-8 text-foreground">It's a No-Brainer</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                Icon: Lock,
                title: "Zero Financial Risk",
                body: "We don't charge upfront. We only make money if you're happy.",
              },
              {
                Icon: ShieldCheck,
                title: "No Bad Outcome",
                body: "At worst, you get validation. At best, you save thousands.",
              },
              {
                Icon: Handshake,
                title: "You're in Control",
                body: "You decide on the quote, the contractor, and the terms.",
              },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="card-raised-hero rounded-xl p-8">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white mx-auto mb-4"
                  style={{
                    background: "linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(37,99,235,0.25)",
                  }}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-display font-extrabold tracking-tight mb-2 text-lg text-foreground">{title}</h3>
                <p className="text-foreground/75 text-sm">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
