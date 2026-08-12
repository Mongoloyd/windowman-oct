const criteria = [
  {
    title: "Price positioning",
    copy: "How the total and per-opening cost can be evaluated alongside comparable project context.",
    icon: <><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  },
  {
    title: "Scope completeness",
    copy: "Whether stucco repair, trim, disposal, permits, and finish work are actually written in.",
    icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
  },
  {
    title: "Product specification",
    copy: "Whether the frame series, glass package, and Florida product approval are identified or left vague.",
    icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  },
  {
    title: "Warranty terms",
    copy: "Labor vs. manufacturer coverage, duration, and whether transferability is stated at all.",
    icon: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 2" /></>,
  },
  {
    title: "Fees & financing",
    copy: "Line items that aren't itemized, and financing costs that may be built into the headline price.",
    icon: <><path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4" /><path d="M9 11V4h6v7" /></>,
  },
  {
    title: "Contract language",
    copy: "Cancellation windows, deposit terms, price-escalation clauses, and expiring \"today only\" pricing.",
    icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
  },
];

export default function ReviewCriteria() {
  return (
    <section className="sec-criteria">
      <div className="wrap">
        <div className="sec-head">
          <div className="sec-eyebrow">What WindowMan reviews</div>
          <h2>The parts of an estimate people skim.</h2>
          <p className="sec-sub">A contractor still needs to measure, verify site conditions, and provide the final construction agreement. WindowMan helps you understand the written estimate before you sign it.</p>
        </div>

        <div className="checks">
          {criteria.map((item) => (
            <div className="chk" key={item.title}>
              <div className="chk-ic">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                  {item.icon}
                </svg>
              </div>
              <div><h4>{item.title}</h4><p>{item.copy}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
