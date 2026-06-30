const sampleFindings = [
  { label: "Permit handling language", status: "Needs Clarification" as const },
  { label: "Product approval details", status: "Needs Review" as const },
  { label: "Warranty scope", status: "High Risk" as const },
  { label: "Line-item scope completeness", status: "Strong" as const },
];

type TruthReportShowcaseProps = {
  expanded: boolean;
  onToggle: () => void;
};

export default function TruthReportShowcase({ expanded, onToggle }: TruthReportShowcaseProps) {
  return (
    <section id="sample-report" className="border-t border-border bg-card px-4 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <p className="wm-eyebrow mb-3 text-primary">Sample report preview</p>
        <h2 className="wm-title-section mb-2 text-foreground">See what a Truth Report surfaces</h2>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Representative example — not your personal results.
        </p>
        <p className="mb-10 max-w-2xl text-sm text-muted-foreground">
          Your actual report depends on your uploaded quote. Full Truth Report access requires mobile
          verification on the canonical WindowMan flow.
        </p>

        <div className="card-raised-hero max-w-2xl p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              Sample report preview
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Representative example
            </span>
          </div>

          <ul className="space-y-3" aria-label="Sample report findings">
            {sampleFindings.map((finding) => (
              <li
                key={finding.label}
                className="flex flex-col gap-1 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-medium text-foreground">{finding.label}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {finding.status}
                </span>
              </li>
            ))}
          </ul>

          {expanded ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Additional sample sections — pricing context, scope notes, and homeowner protection
              reminders — would appear here in a later phase. Still representative only.
            </p>
          ) : null}

          <button
            type="button"
            onClick={onToggle}
            className="mt-6 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {expanded ? "Collapse sample preview" : "View Sample Truth Report"}
          </button>
        </div>
      </div>
    </section>
  );
}
