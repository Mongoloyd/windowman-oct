import { useState, useEffect } from "react";

interface StickyRecoveryBarProps { stepsCompleted: number; county: string; isVisible: boolean; onDismiss: () => void; flowMode?: 'A' | 'B'; flowBLeadCaptured?: boolean; quoteWatcherSet?: boolean; onDemoCTAClick?: () => void; leadCaptured?: boolean; isDevMode?: boolean; gradeRevealed?: boolean; onContractorMatchClick?: () => void; }

const getStatusCopy = (steps: number, flowMode: string, flowBLeadCaptured: boolean) => {
  if (flowMode === 'B') { if (!flowBLeadCaptured) return { line1: "Your baseline is being configured.", line2: "Takes less than a minute." }; return { line1: "Set your quote reminder to complete Flow B.", line2: "Your analysis is waiting." }; }
  switch (steps) { case 0: return { line1: "Start your free quote check.", line2: "Takes less than a minute." }; default: return { line1: "Finish your quote check.", line2: "Your analysis is waiting." }; }
};
const getCtaText = (steps: number, flowMode: string, flowBLeadCaptured: boolean) => { if (flowMode === 'B') { if (!flowBLeadCaptured) return "Continue to Baseline →"; return "Set My Reminder →"; } if (steps === 0) return "Start Free →"; return "Continue →"; };
const getCtaTarget = (flowMode: string, flowBLeadCaptured: boolean) => { if (flowMode === 'B') return flowBLeadCaptured ? "quote-watcher" : "market-baseline"; return "truth-gate"; };

const StickyRecoveryBar = ({ stepsCompleted, county, isVisible, onDismiss, flowMode = 'A', flowBLeadCaptured = false, quoteWatcherSet = false, onDemoCTAClick, leadCaptured = false, isDevMode = false, gradeRevealed = false, onContractorMatchClick }: StickyRecoveryBarProps) => {
  const [isUrgent, setIsUrgent] = useState(false);
  useEffect(() => { if (!isVisible) return; const timer = setTimeout(() => { if (stepsCompleted > 0) setIsUrgent(true); }, 150000); return () => clearTimeout(timer); }, [isVisible, stepsCompleted]);

  if (!isDevMode && flowMode === 'B' && quoteWatcherSet) return null;

  const { line1, line2 } = getStatusCopy(stepsCompleted, flowMode, flowBLeadCaptured);
  const postReveal = gradeRevealed;
  const displayLine1 = postReveal ? "Your grade report is ready." : line1;
  const displayCta = postReveal ? "Find a Contractor →" : getCtaText(stepsCompleted, flowMode, flowBLeadCaptured);

  const handleCta = () => {
    if (gradeRevealed && onContractorMatchClick) { onContractorMatchClick(); return; }
    const target = getCtaTarget(flowMode, flowBLeadCaptured);
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
  };

  if (!isVisible) return null;

  return (
    <div className="wm-sticky-recovery-enter" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 8000 }}>
          <div className="px-5 py-3.5 sm:px-8 sm:py-4 bg-card/95 backdrop-blur-xl border-t-2" style={{ borderColor: isUrgent && flowMode === 'A' && !postReveal ? "hsl(var(--color-vivid-orange))" : "hsl(var(--primary))", boxShadow: "0 -4px 24px rgba(0,0,0,0.06)" }}>
            <div className="max-w-4xl mx-auto flex flex-nowrap items-center justify-between gap-4 relative">
              <div className="hidden sm:flex items-center gap-3.5 min-w-0 flex-shrink">
                <div className="min-w-0"><p className="whitespace-nowrap truncate font-body text-sm font-bold text-foreground">{displayLine1}</p></div>
              </div>
              <div className="flex items-center gap-2.5 flex-1 sm:flex-none justify-center sm:justify-end">
                <button onClick={handleCta} className="btn-depth-primary whitespace-nowrap" style={{ fontSize: 14, padding: "10px 16px" }}>{displayCta}</button>
                <button onClick={() => { if (!isDevMode) localStorage.setItem("wm_recovery_bar_dismissed", "true"); onDismiss(); }} className="bg-transparent border-none w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground text-base cursor-pointer hover:text-foreground transition-colors" aria-label="Dismiss">×</button>
              </div>
            </div>
          </div>
    </div>
  );
};

export default StickyRecoveryBar;
