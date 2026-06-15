import { Helmet } from "react-helmet-async";
import { Shield, Lock, EyeOff, FileSearch, ClipboardList, Upload, ArrowRight } from "lucide-react";

const HANDOFF_HAS_QUOTE =
  "/?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=nextdoor_clone&utm_content=has_quote&wm_intent=has_quote#truth-gate";

const HANDOFF_NO_QUOTE =
  "/?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=nextdoor_clone&utm_content=no_quote&wm_intent=no_quote#truth-gate";

const TRUST_CARDS = [
  {
    icon: Lock,
    title: "Your quote stays private",
    body: "Uploaded quotes are stored securely and are not shared back with the original contractor.",
  },
  {
    icon: EyeOff,
    title: "No contractor spam",
    body: "WindowMan is a review tool for homeowners — not a contractor blast list or lead resale page.",
  },
  {
    icon: Shield,
    title: "Questions, not promises",
    body: "We highlight deposit terms, scope gaps, and warranty language so you know what to ask before you sign.",
  },
] as const;

const CHECK_ITEMS = [
  "Deposit and payment timing",
  "Permit responsibility and inspection language",
  "Product approval references (when shown on the quote)",
  "Scope clarity — labor, materials, and exclusions",
  "Warranty terms and fine-print limits",
  "Pricing structure and line-item transparency",
] as const;

const STEPS = [
  {
    num: "1",
    title: "Answer a few quick questions",
    body: "County, project scope, and quote context — no account required to start.",
    icon: ClipboardList,
  },
  {
    num: "2",
    title: "Upload your quote",
    body: "PDF or photo from any Florida contractor. The scan runs on the existing WindowMan flow.",
    icon: Upload,
  },
  {
    num: "3",
    title: "Review before you commit",
    body: "See a preview, then unlock the full Truth Report through the same SMS verification step used on the main site.",
    icon: FileSearch,
  },
] as const;

export default function NextdoorHome() {
  return (
    <>
      <Helmet>
        <title>Review Your Impact-Window Quote | WindowMan</title>
        <meta
          name="description"
          content="Before you sign a window quote, make sure it says what you think it says. WindowMan helps Florida homeowners review impact-window quotes for scope, permits, approvals, warranty, and pricing."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div
        className="min-h-screen bg-background text-foreground"
        style={{
          background:
            "linear-gradient(170deg, hsl(214 35% 95%) 0%, hsl(216 38% 93%) 40%, hsl(218 32% 94%) 100%)",
        }}
      >
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm">
          <div className="mx-auto flex h-16 max-w-5xl items-center px-4 md:px-8">
            <a
              href="/"
              className="inline-flex items-center gap-2 select-none"
              aria-label="WindowMan home"
            >
              <span role="img" aria-label="shield" className="text-base">
                🛡️
              </span>
              <span className="font-display text-lg font-extrabold tracking-wide">
                <span className="text-foreground">WINDOW</span>
                <span className="text-primary">MAN</span>
                <sup className="ml-0.5 text-[8px] font-normal text-muted-foreground">.PRO</sup>
              </span>
            </a>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-20 pt-10 md:px-8 md:pt-16">
          {/* Hero */}
          <section className="mb-14 text-center md:mb-16">
            <p className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Florida impact-window quote review
            </p>
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl">
              Before you sign a window quote, make sure it says what you think it says.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-foreground/80 md:text-lg">
              WindowMan helps Florida homeowners review impact-window quotes for missing scope,
              unclear permit language, product approval references, warranty terms, payment timing,
              and pricing structure.
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
              No pressure. No contractor spam. Your quote review starts on the existing WindowMan
              scan flow — the same path as the main homepage.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href={HANDOFF_HAS_QUOTE} className="btn-depth-primary w-full sm:w-auto" style={{ padding: "16px 32px", fontSize: 16 }}>
                Check My Quote Before I Sign
              </a>
              <a
                href={HANDOFF_NO_QUOTE}
                className="w-full rounded-lg border border-border bg-card px-8 py-4 text-center text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/40 sm:w-auto"
              >
                I&apos;m Still Getting Quotes
              </a>
            </div>
          </section>

          {/* Trust cards */}
          <section className="mb-14 grid gap-4 md:mb-16 md:grid-cols-3">
            {TRUST_CARDS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card-raised p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </section>

          {/* What WindowMan checks */}
          <section id="what-we-check" className="mb-14 scroll-mt-24 md:mb-16">
            <div className="card-dominant p-8 md:p-10">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                What we look for
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-foreground md:text-3xl">
                What WindowMan checks
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                We help you spot questions worth asking — not issue legal opinions or certify
                compliance.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {CHECK_ITEMS.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-background/60 px-4 py-3 text-sm text-foreground"
                  >
                    <span className="mt-0.5 text-primary" aria-hidden="true">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <a
                  href="#what-we-check"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  See What WindowMan Checks
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="mb-14 md:mb-16">
            <p className="text-center font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              How it works
            </p>
            <h2 className="mt-2 text-center font-display text-2xl font-extrabold text-foreground md:text-3xl">
              Three steps on the main WindowMan flow
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ num, title, body, icon: Icon }) => (
                <div key={num} className="card-raised flex flex-col p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {num}
                    </span>
                    <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA band */}
          <section className="mb-12 rounded-xl border border-primary/20 bg-primary/5 p-8 text-center md:p-10">
            <h2 className="font-display text-2xl font-extrabold text-foreground">
              Signing day is the wrong time to find a gap
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              A quick review now can surface questions worth asking before you commit — on the same
              WindowMan scan, verification, and report path as the main homepage.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href={HANDOFF_HAS_QUOTE} className="btn-depth-primary w-full sm:w-auto" style={{ padding: "14px 28px" }}>
                Check My Quote Before I Sign
              </a>
              <a
                href={HANDOFF_NO_QUOTE}
                className="w-full rounded-lg border border-border bg-card px-6 py-3.5 text-center text-sm font-semibold text-foreground hover:border-primary/40 sm:w-auto"
              >
                I&apos;m Still Getting Quotes
              </a>
            </div>
          </section>

          {/* Disclaimer + footer */}
          <footer className="border-t border-border/60 pt-8">
            <p className="text-sm leading-relaxed text-muted-foreground">
              WindowMan is not a law firm, contractor, building department, or insurance advisor. We
              do not guarantee savings, legal compliance, code compliance, or specific outcomes. We
              help Florida homeowners understand questions worth asking before signing an
              impact-window quote.
            </p>
            <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-foreground" aria-label="Legal">
              <a href="/privacy" className="hover:text-primary hover:underline">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:text-primary hover:underline">
                Terms
              </a>
              <a href="/disclaimer" className="hover:text-primary hover:underline">
                Disclaimer
              </a>
            </nav>
          </footer>
        </main>
      </div>
    </>
  );
}
