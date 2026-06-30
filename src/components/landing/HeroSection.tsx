import {
  handoffToCanonicalUpload,
  handoffToFirstQuotePath,
  handoffToSystemExplainer,
} from "./landingHandoff";

const sampleFindings = [
  { label: "Permit handling language", status: "Needs Clarification" as const },
  { label: "Product approval details", status: "Needs Review" as const },
  { label: "Warranty scope", status: "High Risk" as const },
  { label: "Line-item scope completeness", status: "Strong" as const },
];

function statusTone(status: (typeof sampleFindings)[number]["status"]): string {
  switch (status) {
    case "Strong":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "High Risk":
      return "bg-destructive/10 text-destructive";
    case "Needs Clarification":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function HeroSampleVisual() {
  return (
    <div
      className="card-raised-hero w-full max-w-lg p-5 md:p-6"
      aria-label="Sample quote-to-report visual — representative example only"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          Sample report preview
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Representative example
        </span>
      </div>

      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Quote
          </p>
          <div className="space-y-1.5">
            <div className="h-1.5 rounded bg-muted" />
            <div className="h-1.5 w-4/5 rounded bg-muted" />
            <div className="h-1.5 w-3/5 rounded bg-muted" />
          </div>
        </div>
        <span className="text-lg text-primary" aria-hidden="true">
          →
        </span>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Analysis
          </p>
          <div className="flex flex-wrap justify-center gap-1">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
              Scope
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
              Pricing
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
              Risk
            </span>
          </div>
        </div>
      </div>

      <p className="mb-3 font-display text-sm font-bold text-foreground">Truth Report</p>
      <ul className="space-y-2.5" aria-label="Sample report findings">
        {sampleFindings.map((finding) => (
          <li
            key={finding.label}
            className="flex flex-col gap-1.5 border-b border-border pb-2.5 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-xs font-medium text-foreground">{finding.label}</span>
            <span
              className={`inline-flex w-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(finding.status)}`}
            >
              {finding.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section id="hero" className="relative px-4 py-12 md:px-8 md:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="order-1">
            <p className="wm-eyebrow mb-4 text-primary">FREE WINDOW QUOTE INTELLIGENCE</p>
            <h1 className="mb-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-[3.25rem]">
              Understand your impact-window quote before you sign.
            </h1>

            <p className="mb-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              WindowMan helps homeowners review impact-window estimates for missing scope, vague terms,
              pricing signals, and questions worth asking before a high-ticket decision.
            </p>

            <div className="mb-8 rounded-lg border border-border bg-card/60 p-4 md:max-w-xl">
              <p className="text-sm leading-relaxed text-foreground">
                <span className="font-semibold">I&apos;m Sam Glass — WindowMan.</span>{" "}
                <span className="text-muted-foreground">
                  I do not sell windows. I help homeowners understand the quote before they sign,
                  negotiate, or request their first estimate.
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => handoffToCanonicalUpload()}
                className="btn-depth-primary w-full sm:w-auto"
                style={{ padding: "14px 28px", fontSize: 15 }}
              >
                Analyze My Quote
              </button>
              <button
                type="button"
                onClick={() => handoffToFirstQuotePath()}
                className="btn-secondary-tactile w-full sm:w-auto"
                style={{ padding: "14px 28px", fontSize: 15 }}
              >
                Help Me Get My First Quote
              </button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => handoffToSystemExplainer()}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                See how it works
              </button>
            </p>

            <p className="mt-5 max-w-xl text-xs leading-relaxed text-muted-foreground">
              No contractor pressure. Sample report content only. Your actual report depends on your
              uploaded quote.
            </p>
          </div>

          <div className="order-2 flex justify-center lg:justify-end">
            <HeroSampleVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
