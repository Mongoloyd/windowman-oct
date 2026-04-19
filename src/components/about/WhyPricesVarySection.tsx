import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";
import SkeuoCard from "./SkeuoCard";

const varianceCards = [
  {
    title: "Scope Definition",
    body: "One quote may include removal, sealing, trim, disposal, or permit coordination while another leaves those items vague or excluded.",
  },
  {
    title: "Material Specification",
    body: "Window category, glass build, product approvals, energy profile, and system quality can alter the real value of the quote without changing the headline format.",
  },
  {
    title: "Labor Assumptions",
    body: "Installation detail is one of the biggest hidden variables. Similar prices can mask radically different workmanship expectations.",
  },
  {
    title: "Warranty Posture",
    body: "A cheaper quote with weak labor coverage or restrictive exclusions may not be cheaper in outcome.",
  },
  {
    title: "Margin & Strategy",
    body: "Some pricing reflects genuine complexity. Some reflects loose standards, aggressive margin, or low-information selling conditions.",
  },
];

const varianceMarkers = [
  { label: "Scope", note: "What is actually included?" },
  { label: "Protection", note: "What happens if something goes wrong?" },
  { label: "True Cost", note: "Total economic exposure over time." },
];

export default function WhyPricesVarySection() {
  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — blue radial, upper right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "-20%",
          right: "-8%",
          width: "58%",
          height: "90%",
          background: "radial-gradient(ellipse at 65% 35%, rgba(30,80,180,0.08) 0%, rgba(56,130,220,0.04) 55%, transparent 72%)",
          filter: "blur(38px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <SectionEyebrow className="mb-4">WHY THE NUMBERS DRIFT</SectionEyebrow>
          <SectionHeading className="mb-6">
            Why the Same Project Can Vary 20–50%
          </SectionHeading>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground/80 md:text-lg">
            Two proposals can describe the same home and still differ sharply in
            scope clarity, specification quality, installation detail, warranty
            strength, and final economics.
          </p>
        </div>

        {/* 5-Card Grid */}
        <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {varianceCards.map((card) => (
            <SkeuoCard key={card.title}>
              <div className="mb-3 h-0.5 w-8 rounded-full bg-cyan-500" />
              <h3 className="mb-3 font-display text-xl font-bold tracking-tight text-foreground">
                {card.title}
              </h3>
              <p className="text-sm leading-relaxed text-foreground/70 font-semibold px-[6px]">
                {card.body}
              </p>
            </SkeuoCard>
          ))}
        </div>

        {/* Variance Strip */}
        <div className="card-raised overflow-hidden rounded-2xl border-4 border-double border-emerald-500">
          <div className="grid md:grid-cols-3">
            {varianceMarkers.map((marker, i) => (
              <div
                key={marker.label}
                className={`flex flex-col gap-2 p-6 ${
                  i < varianceMarkers.length - 1
                    ? "border-b border-slate-200 md:border-b-0 md:border-r"
                    : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-full"
                    style={{
                      background:
                        i === 0
                          ? "#06b6d4"
                          : i === 1
                            ? "#f97316"
                            : "#1e3a5f",
                    }}
                    aria-hidden="true"
                  />
                  <span className="font-display text-lg font-bold tracking-tight text-foreground">
                    {marker.label}
                  </span>
                </div>
                <p className="pl-6 text-sm text-foreground/60 font-semibold">{marker.note}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-4 text-center">
            <p className="text-sm italic text-foreground/60">
              When these variables aren't normalized, price becomes a false
              anchor.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
