const trustPoints = [
  "WindowMan helps Florida homeowners review impact-window quotes before signing.",
  "WindowMan is a quote-review tool, not a contractor marketplace.",
  "We do not guarantee savings, code compliance, or contractor performance.",
  "Full Truth Report access requires mobile verification — preview comes first.",
  "If you request contractor help, WindowMan may earn a referral fee from an introduced contractor.",
];

export default function TrustCredibilitySection() {
  return (
    <section id="trust-credibility" className="px-4 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="wm-eyebrow mb-3 text-primary">Trust and transparency</p>
        <h2 className="wm-title-section mb-6 text-foreground">Homeowner protection, clearly stated</h2>
        <ul className="space-y-4">
          {trustPoints.map((point) => (
            <li key={point} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
