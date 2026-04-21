import { useState } from "react";
import { motion } from "framer-motion";
import "@fontsource/dm-mono/500.css";

const questions = [
  { id: 1, severity: "critical" as const, question: "Is the window brand, product line, and series specified by name in the contract?", label: "⚑ CRITICAL — MOST COMMONLY MISSED", labelColor: "#F97316", circleBg: "rgba(249,115,22,0.08)", circleBorder: "#F97316", why: `"Impact windows" is not a brand. PGT WinGuard Series 500, SGT Impact Plus, or Lawson LP Impact are brands. If your contract says only "impact windows," your contractor can legally install any brand at any quality level — and charge premium prices for a budget product.`, askLabel: "SAY EXACTLY THIS:", askColor: "#F97316", askBorder: "#F97316", askText: `"What specific brand, product line, and series of window will you be installing? I need that language in the contract before I sign."` },
  { id: 2, severity: "critical" as const, question: "Does the labor warranty period match the manufacturer's product warranty?", label: "⚑ HIGH RISK — FINANCIAL EXPOSURE", labelColor: "#F97316", circleBg: "rgba(249,115,22,0.08)", circleBorder: "#F97316", why: `Many contractors offer a 1-year labor warranty on windows that carry a 10-year or lifetime manufacturer warranty. Industry standard is a minimum 3-year labor warranty.`, askLabel: "SAY EXACTLY THIS:", askColor: "#F97316", askBorder: "#F97316", askText: `"What is your labor warranty period for this installation? And does it remain valid if I file a manufacturer warranty claim?"` },
  { id: 3, severity: "important" as const, question: "Are permit fees listed as a separate line item, or 'included' in the total price?", label: "⚡ IMPORTANT — LEVERAGE POINT", labelColor: "#2563EB", circleBg: "rgba(37,99,235,0.08)", circleBorder: "#2563EB", why: `The word "included" is one of the most expensive words in a window contract. Permit costs should always be a line item with a real dollar amount.`, askLabel: "SAY EXACTLY THIS:", askColor: "#2563EB", askBorder: "#2563EB", askText: `"Can you show me the permit fee as a separate line item with a dollar amount?"` },
  { id: 4, severity: "important" as const, question: "What is the NOA (Notice of Acceptance) number for the specific windows being installed?", label: "⚡ IMPORTANT — LEVERAGE POINT", labelColor: "#2563EB", circleBg: "rgba(37,99,235,0.08)", circleBorder: "#2563EB", why: `Every legitimate impact window has a NOA. If your contractor cannot provide it, they may be installing a product that doesn't meet Florida Building Code.`, askLabel: "SAY EXACTLY THIS:", askColor: "#2563EB", askBorder: "#2563EB", askText: `"What is the Miami-Dade NOA number for the windows you're installing?"` },
  { id: 5, severity: "technical" as const, question: "Is the installation method specified — buck frame, fin, or flush installation?", label: "◎ TECHNICAL — QUALITY ASSURANCE", labelColor: "#2563EB", circleBg: "rgba(37,99,235,0.08)", circleBorder: "#2563EB", why: `If the method isn't specified, you don't know what you're getting. Contractors who don't specify it are protecting their flexibility, not your home.`, askLabel: "SAY EXACTLY THIS:", askColor: "#2563EB", askBorder: "#2563EB", askText: `"Is this a fin installation, buck frame, or full frame replacement? Can you add the installation method to the contract language?"` },
];

interface ForensicChecklistProps { onUploadQuote?: () => void; onSetReminder?: () => void; }

const ForensicChecklist = ({ onUploadQuote, onSetReminder }: ForensicChecklistProps) => {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const toggleCheck = (id: number) => setChecked({ ...checked, [id]: !checked[id] });

  return (
    <section id="forensic-checklist" className="bg-background border-t border-border">
      <div className="mx-auto max-w-3xl px-4 py-16 md:px-8 md:py-24">
        <div className="relative overflow-hidden card-raised-hero">
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none" style={{ zIndex: 0 }}>
            <div className="font-mono text-2xl text-foreground/[0.03] whitespace-nowrap leading-[2.5]" style={{ transform: "rotate(-35deg)" }}>
              {Array.from({ length: 12 }).map((_, i) => (<div key={i}>WINDOWMAN FORENSIC &nbsp;&nbsp;&nbsp; WINDOWMAN FORENSIC &nbsp;&nbsp;&nbsp; WINDOWMAN FORENSIC</div>))}
            </div>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted border-b border-border px-7 py-4">
            <div className="shrink-0"><p className="font-mono text-[13px] text-destructive font-bold tracking-[0.15em]">WINDOWMAN.APP</p><p className="font-mono text-[10px] text-muted-foreground">Forensic Intelligence Division</p></div>
            <div className="text-left sm:text-center flex-1"><p className="font-mono text-xs text-foreground font-bold">HOMEOWNER'S FORENSIC CHECKLIST</p><p className="font-mono text-[10px] text-muted-foreground">Pre-Quote Site Visit Edition</p></div>
            <div className="shrink-0"><div className="bg-destructive/10 border border-destructive/30 px-2.5 py-1"><p className="font-mono text-[10px] text-destructive font-bold tracking-[0.08em]">CONFIDENTIAL</p></div></div>
          </div>

          <div className="relative z-10 flex gap-4 items-start px-7 pt-7 pb-5 border-b border-border">
            <div>
              <p className="font-display text-xl font-bold text-foreground uppercase">5 Questions Contractors Hope You Never Ask</p>
              <p className="font-body text-sm text-muted-foreground leading-[1.75] mt-1.5">These questions expose the information asymmetry in every impact window sales pitch. Bring this checklist to your site visit.</p>
            </div>
          </div>

          <div className="relative z-10 px-7">
            {questions.map((q) => (
              <div key={q.id} className="py-6 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="shrink-0 flex items-center justify-center w-8 h-8" style={{ background: q.circleBg, border: `1.5px solid ${q.circleBorder}` }}>
                      <span className="font-mono text-sm font-black" style={{ color: q.circleBorder }}>{q.id}</span>
                    </div>
                    <p className="font-body text-base font-bold text-foreground leading-snug pt-1">{q.question}</p>
                  </div>
                  <button onClick={() => toggleCheck(q.id)} className="shrink-0 mt-1 w-6 h-6 flex items-center justify-center cursor-pointer transition-all"
                    style={{ border: `2px solid ${checked[q.id] ? "hsl(var(--primary))" : "hsl(var(--border))"}`, background: checked[q.id] ? "hsl(var(--primary))" : "transparent" }}>
                    {checked[q.id] && (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>)}
                  </button>
                </div>
                <div className="mt-3 bg-muted p-3.5">
                  <p className="font-mono text-[10px] tracking-[0.1em] mb-2" style={{ color: q.labelColor }}>{q.label}</p>
                  <p className="font-body text-[13px] text-muted-foreground leading-[1.7]">{q.why}</p>
                </div>
                <div className="mt-3 bg-card p-3" style={{ borderLeft: `3px solid ${q.askBorder}` }}>
                  <p className="font-mono text-[10px] tracking-[0.08em] mb-1" style={{ color: q.askColor }}>{q.askLabel}</p>
                  <p className="font-body text-sm text-foreground italic font-medium leading-relaxed">{q.askText}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative z-10 px-7 py-6 border-t border-border bg-muted">
            <div className="flex items-center gap-3 mb-3">
              <p className="font-mono text-xs text-muted-foreground">{checkedCount} of 5 reviewed</p>
              <div className="flex-1 h-1 bg-border overflow-hidden">
                <motion.div className="h-full bg-primary" animate={{ width: `${(checkedCount / 5) * 100}%` }} transition={{ duration: 0.15 }} />
              </div>
            </div>
            {checkedCount === 5 && (
              <>
                <p className="font-body text-sm font-semibold text-primary">✓ All 5 confirmed. Upload your final contract for a full AI grade before you sign.</p>
                <motion.button onClick={() => onUploadQuote?.()} className="btn-depth-primary mt-3" style={{ fontSize: 15, padding: "14px 28px" }}>
                  Upload My Quote for a Full Grade →
                </motion.button>
              </>
            )}
            <button onClick={() => { window.print(); }} className="mt-4 block bg-card border border-border px-6 py-3 font-body text-sm font-semibold text-foreground cursor-pointer">
              ⬇ Save Checklist as PDF
            </button>
          </div>
        </div>

        <div className="text-center card-raised mt-8" style={{ padding: "40px 28px" }}>
          <h3 className="font-display text-[26px] font-extrabold tracking-[0.02em] text-foreground uppercase">Now set the reminder.</h3>
          <p className="font-body text-[15px] text-muted-foreground mt-2">When is your contractor visiting? We'll text you 15 minutes after they leave.</p>
          <motion.button onClick={onSetReminder} className="btn-depth-primary mt-5 inline-block" style={{ fontSize: 15, padding: "14px 32px" }}>
            Set My Quote Reminder →
          </motion.button>
        </div>
      </div>
    </section>
  );
};

export default ForensicChecklist;
