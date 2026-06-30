import { FileText, MessageCircle, Sparkles } from "lucide-react";
import {
  iconFrame,
  innerPanelElevated,
  processCard,
  sectionGap,
  sectionHeadline,
  sectionLabel,
} from "./prescriptionTokens";

const STEPS = [
  {
    icon: FileText,
    title: "Report",
    body: "We use your quote report and risk findings.",
  },
  {
    icon: Sparkles,
    title: "Preferences",
    body: "We use your budget, timing, and decision needs.",
  },
  {
    icon: MessageCircle,
    title: "Better Quote Conversation",
    body: "Your advisor helps you ask for the terms that make the next quote safer.",
  },
] as const;

export function BetterQuoteProcessBlock() {
  return (
    <div className={`${processCard} ${sectionGap} p-7 md:p-9`}>
      <p className={`${sectionLabel} mb-2`}>What Happens Next</p>
      <h3 className={`${sectionHeadline} text-xl md:text-2xl mb-2`}>How WindowMan Helps Next</h3>
      <p className="text-sm font-bold text-blue-700/90 mb-8 tracking-wide">
        Report → Preferences → Better Quote Conversation
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-3 relative">
        <div
          aria-hidden
          className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px bg-gradient-to-r from-blue-200 via-blue-400/50 to-blue-200"
        />
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className={`${innerPanelElevated} relative p-5 md:p-6 text-center md:text-left`}
          >
            <div className="flex flex-col md:flex-row items-center md:items-start gap-3 mb-4">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)] ring-4 ring-white">
                {index + 1}
              </span>
              <div className={`${iconFrame} w-9 h-9 hidden md:flex`}>
                <step.icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <h4 className="font-bold text-slate-900 mb-2 text-base md:text-lg">{step.title}</h4>
            <p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
