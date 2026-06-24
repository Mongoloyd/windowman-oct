import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRightCircle,
  Clock,
  Compass,
  LayoutGrid,
  Lock,
  Mail,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import type { IntakeStep } from "./intakeTypes";

/** Subtle per-step visual mood — accent, glow, helper. No animation layer yet. */
export type StepMoodToken = {
  moodLabel: string;
  helper?: string;
  icon: LucideIcon;
  accentText: string;
  accentBorder: string;
  accentBg: string;
  accentRing: string;
  panelGlow: string;
  progressFrom: string;
  progressVia: string;
  progressTo: string;
  chipActive: string;
};

export const STEP_MOOD: Record<IntakeStep, StepMoodToken> = {
  intent: {
    moodLabel: "Orientation",
    helper: "Start with where you are. WindowMan will route you to the right next step.",
    icon: Compass,
    accentText: "text-cyan-300",
    accentBorder: "border-cyan-400/35",
    accentBg: "bg-cyan-500/12",
    accentRing: "ring-cyan-400/40",
    panelGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_40px_80px_-70px_rgba(34,211,238,0.18)]",
    progressFrom: "from-cyan-700",
    progressVia: "via-cyan-500",
    progressTo: "to-cyan-300",
    chipActive: "bg-cyan-500/22 text-cyan-100 ring-cyan-400/45",
  },
  threat: {
    moodLabel: "Risk check",
    helper: "This helps us prioritize what to flag before you sign.",
    icon: AlertTriangle,
    accentText: "text-amber-200",
    accentBorder: "border-amber-400/30",
    accentBg: "bg-amber-500/10",
    accentRing: "ring-amber-400/35",
    panelGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_40px_80px_-70px_rgba(251,191,36,0.12)]",
    progressFrom: "from-amber-600",
    progressVia: "via-cyan-500",
    progressTo: "to-cyan-300",
    chipActive: "bg-amber-500/18 text-amber-100 ring-amber-400/35",
  },
  projectSize: {
    moodLabel: "Project scope",
    helper: "Rough scope is enough — exact counts can come later.",
    icon: LayoutGrid,
    accentText: "text-blue-200",
    accentBorder: "border-blue-400/30",
    accentBg: "bg-blue-500/10",
    accentRing: "ring-blue-400/35",
    panelGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_40px_80px_-70px_rgba(59,130,246,0.14)]",
    progressFrom: "from-blue-600",
    progressVia: "via-cyan-500",
    progressTo: "to-cyan-300",
    chipActive: "bg-blue-500/18 text-blue-100 ring-blue-400/35",
  },
  interstitial: {
    moodLabel: "File assembly",
    icon: Sparkles,
    accentText: "text-cyan-300",
    accentBorder: "border-cyan-400/30",
    accentBg: "bg-cyan-500/10",
    accentRing: "ring-cyan-400/35",
    panelGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_40px_80px_-70px_rgba(34,211,238,0.15)]",
    progressFrom: "from-cyan-700",
    progressVia: "via-cyan-500",
    progressTo: "to-cyan-300",
    chipActive: "bg-cyan-500/22 text-cyan-100 ring-cyan-400/45",
  },
  contact: {
    moodLabel: "Private save",
    helper: "Your quote check stays private until you choose to share more.",
    icon: Lock,
    accentText: "text-teal-200",
    accentBorder: "border-teal-400/30",
    accentBg: "bg-teal-500/10",
    accentRing: "ring-teal-400/35",
    panelGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_40px_80px_-70px_rgba(45,212,191,0.12)]",
    progressFrom: "from-teal-600",
    progressVia: "via-cyan-500",
    progressTo: "to-cyan-300",
    chipActive: "bg-teal-500/18 text-teal-100 ring-teal-400/35",
  },
  identity: {
    moodLabel: "Recovery path",
    helper: "So we can send your reminder and findings securely.",
    icon: Mail,
    accentText: "text-sky-200",
    accentBorder: "border-sky-400/30",
    accentBg: "bg-sky-500/10",
    accentRing: "ring-sky-400/35",
    panelGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_40px_80px_-70px_rgba(56,189,248,0.12)]",
    progressFrom: "from-sky-600",
    progressVia: "via-cyan-500",
    progressTo: "to-cyan-300",
    chipActive: "bg-sky-500/18 text-sky-100 ring-sky-400/35",
  },
  callIntent: {
    moodLabel: "Walkthrough",
    helper: "Optional — you can finish by text or email instead.",
    icon: PhoneCall,
    accentText: "text-emerald-200",
    accentBorder: "border-emerald-400/30",
    accentBg: "bg-emerald-500/10",
    accentRing: "ring-emerald-400/35",
    panelGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_40px_80px_-70px_rgba(52,211,153,0.12)]",
    progressFrom: "from-emerald-600",
    progressVia: "via-cyan-500",
    progressTo: "to-cyan-300",
    chipActive: "bg-emerald-500/18 text-emerald-100 ring-emerald-400/35",
  },
  timeline: {
    moodLabel: "Decision timing",
    helper: "Helps us pace reminders and next steps appropriately.",
    icon: Clock,
    accentText: "text-violet-200",
    accentBorder: "border-violet-400/30",
    accentBg: "bg-violet-500/10",
    accentRing: "ring-violet-400/35",
    panelGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_40px_80px_-70px_rgba(139,92,246,0.12)]",
    progressFrom: "from-violet-600",
    progressVia: "via-cyan-500",
    progressTo: "to-cyan-300",
    chipActive: "bg-violet-500/18 text-violet-100 ring-violet-400/35",
  },
  handoff: {
    moodLabel: "Next move",
    helper: "Your protection file is assembled locally — ready for the next sprint wiring.",
    icon: ArrowRightCircle,
    accentText: "text-cyan-200",
    accentBorder: "border-cyan-400/35",
    accentBg: "bg-cyan-500/12",
    accentRing: "ring-cyan-400/40",
    panelGlow: "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_40px_80px_-70px_rgba(34,211,238,0.16)]",
    progressFrom: "from-teal-600",
    progressVia: "via-cyan-500",
    progressTo: "to-emerald-300",
    chipActive: "bg-cyan-500/22 text-cyan-100 ring-cyan-400/45",
  },
};

/** TODO Sprint C.3: optional per-step micro-animation layer after base visual direction is approved. */

export function getStepMood(step: IntakeStep): StepMoodToken {
  return STEP_MOOD[step];
}
