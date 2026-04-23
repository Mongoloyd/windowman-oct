const GlowEffect = () => (
  <div className="absolute inset-0 rounded-full border border-teal-500/50 [box-shadow:0_0_100px_40px_rgba(45,212,191,0.25)] pointer-events-none" />
);

const flywheelSteps = [
  { id: 1, title: "Homeowner Action", name: "Upload Quote" },
  { id: 2, title: "AI Analysis", name: "Extract Pricing" },
  { id: 3, title: "System Intelligence", name: "Enrich Local Index" },
  { id: 4, title: "Marketing Automation", name: "Train Meta Pixel" },
  { id: 5, title: "Contractor Benefit", name: "Lower CAC" },
  { id: 6, title: "Compounding Growth", name: "More Uploads" },
] as const;

interface FlywheelSectionProps {
  onOpenQualification?: () => void;
}

const FlywheelSection = ({ onOpenQualification }: FlywheelSectionProps) => (
  <section className="py-24 bg-black">
    <div className="max-w-7xl mx-auto px-6">
      <div className="bg-slate-950 text-white p-8 md:p-16 rounded-3xl [background-image:linear-gradient(rgba(2,6,23,1)_0%,rgba(10,25,47,0.8)_100%),radial-gradient(#0f172a_1px,transparent_1px)] [background-size:100%_100%,20px_20px] overflow-hidden">
        <div className="mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-24">

          {/* Left Column */}
          <div className="flex-1 space-y-8 max-w-xl">
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
              The Compounding <br />
              <span className="text-teal-400">Pricing Monopoly</span>
            </h2>
            <div className="space-y-6 text-slate-200 text-lg">
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-teal-400 mt-2.5 flex-shrink-0" />
                <p>
                  Every quote scanned increases the accuracy of <strong className="text-white">every future scan</strong>.
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-teal-400 mt-2.5 flex-shrink-0" />
                <p>
                  We are building the definitive, <strong className="text-white">county-specific database</strong> of real impact window costs.
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-teal-400 mt-2.5 flex-shrink-0" />
                <p>
                  Competitors can copy the software; they cannot reverse-engineer the <strong className="text-white">data density</strong>.
                </p>
              </div>
            </div>
            {onOpenQualification && (
              <button
                type="button"
                onClick={onOpenQualification}
                className="inline-flex items-center justify-center rounded-xl bg-white text-slate-950 font-semibold text-sm px-7 py-3.5 hover:bg-white/90 transition-colors mt-2"
              >
                Leverage Our County Data
              </button>
            )}
          </div>

          {/* Right Column: Flywheel Diagram */}
          <div className="flex-1 w-full max-w-2xl relative mt-12 lg:mt-0">
            <div className="aspect-square w-full max-w-md mx-auto lg:max-w-none rounded-full border border-slate-700/50 flex items-center justify-center p-[10%] relative [background-image:linear-gradient(315deg,#0a192f_0%,#0f172a_74%)] shadow-2xl">

              {/* Central Core */}
              <div className="relative z-10 w-1/3 aspect-square rounded-full border border-teal-500/80 bg-slate-900 shadow-lg flex flex-col items-center justify-center text-center p-2 sm:p-4">
                <GlowEffect />
                <div className="text-[10px] sm:text-xs md:text-sm font-bold text-teal-300 uppercase tracking-widest leading-none mb-1">
                  The Local
                </div>
                <div className="text-xs sm:text-sm md:text-lg font-extrabold text-white leading-tight">
                  Pricing Index
                </div>
              </div>

              {/* Circular Grid Lines */}
              <div className="absolute inset-0 rounded-full border border-slate-700/30 scale-[1.25] pointer-events-none" />
              <div className="absolute inset-0 rounded-full border-2 border-slate-600/50 scale-[0.9] opacity-70 pointer-events-none" />

              {/* Nodes */}
              {flywheelSteps.map((step) => {
                const angle = (step.id - 1) * 60;
                const distance = 45;
                const x = Math.cos((angle - 90) * (Math.PI / 180)) * distance;
                const y = Math.sin((angle - 90) * (Math.PI / 180)) * distance;

                return (
                  <div
                    key={step.id}
                    className="absolute w-[30%] h-[30%] sm:w-1/4 sm:h-1/4 z-20"
                    style={{
                      left: `${50 + x}%`,
                      top: `${50 + y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="relative group w-full h-full flex flex-col items-center justify-center text-center p-1 sm:p-3 rounded-xl border border-teal-900 bg-slate-900/90 hover:bg-slate-800 hover:border-teal-400 hover:scale-105 transition-all duration-300 shadow-xl [backdrop-filter:blur(10px)]">
                      <div className="absolute -top-3 sm:-top-5 flex-shrink-0 w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-slate-950 border border-teal-500 flex items-center justify-center shadow-md">
                        <span className="text-sm sm:text-xl font-black text-teal-400">{step.id}</span>
                      </div>
                      <div className="mt-2 sm:mt-6 flex flex-col items-center gap-0.5 sm:gap-1">
                        <span className="text-[8px] sm:text-[10px] text-slate-300 uppercase tracking-widest leading-none hidden sm:block">
                          {step.title}
                        </span>
                        <span className="text-[9px] sm:text-xs font-bold text-white leading-tight">
                          {step.name}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* External Legend Labels */}
            <div className="hidden xl:flex absolute left-[-15%] top-[18%] flex-col items-end text-sm text-slate-300 font-medium">
              <span className="font-bold text-slate-100">More</span>
              <span>Uploads</span>
            </div>
            <div className="hidden xl:flex absolute right-[-10%] top-[25%] flex-col items-start text-sm text-slate-300 font-medium">
              <span className="font-bold text-slate-100">Extract</span>
              <span>Pricing</span>
            </div>
            <div className="hidden xl:flex absolute left-[-15%] top-[65%] flex-col items-end text-sm text-slate-300 font-medium opacity-60">
              <span className="font-bold text-slate-100">Lower</span>
              <span>CAC</span>
            </div>
            <div className="hidden xl:flex absolute right-[-10%] top-[68%] flex-col items-start text-sm text-slate-300 font-medium opacity-60">
              <span className="font-bold text-slate-100">Enrich</span>
              <span>Local Index</span>
            </div>
            <div className="hidden xl:flex absolute right-[20%] bottom-[-10%] flex-col items-center text-sm text-slate-300 font-medium opacity-40">
              <span className="font-bold text-slate-100">Meta Pixel</span>
              <span>Training</span>
            </div>
            <div className="hidden xl:flex absolute left-[30%] bottom-[-12%] flex-col items-center text-sm text-slate-300 font-medium opacity-40">
              <span className="font-bold text-slate-100">Compounding</span>
              <span>Data Growth</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default FlywheelSection;
