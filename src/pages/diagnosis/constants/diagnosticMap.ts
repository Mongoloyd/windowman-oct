import {
  DollarSign,
  ShieldAlert,
  CreditCard,
  Clock,
  HelpCircle,
  LayoutGrid,
  MessageCircle,
} from 'lucide-react';
import type { DiagnosisCode, DiagnosticConfig } from '../types';

export const DIAGNOSTIC_MAP: Record<DiagnosisCode, DiagnosticConfig> = {
  price_shock: {
    code: 'price_shock',
    label: 'It felt too expensive',
    cardDescription: 'The number felt inflated or hard to justify.',
    Icon: DollarSign,
    accent: 'text-red-700',
    accentBg: 'bg-red-50',
    accentBorder: 'border-red-200',
    reflectionTitle: 'We hear you.',
    reflectionBody:
      "A quote that feels inflated or unclear instantly kills confidence. You deserve transparency—no games, no padding, no surprises.",
    secondaryQuestion: 'What about the price felt off?',
    secondaryOptions: [
      'Way higher than expected',
      'Felt padded',
      "Rep couldn't explain the breakdown",
    ],
    prescriptionSetup:
      "Got it. We'll rebuild your estimate with a clear, line-by-line breakdown so you can finally see what's real and what's fluff.",
    prescriptionHeadline: 'Your Estimate, Priced Honestly.',
    prescriptionSubhead:
      "A line-item quote so you can see exactly what every dollar is paying for.",
    guaranteeTitle: 'Line-Item Transparency Guarantee',
    guarantees: [
      'Every cost broken down by window, material, and labor',
      'No hidden fees, no bundled "miscellaneous" charges',
      'Our audit benchmarks shared alongside the quote',
      'You can challenge any line item before you sign',
    ],
    ctaText: 'Get my line-item estimate',
    prescriptionPath: 'transparency_line_item',
  },
  trust_breakdown: {
    code: 'trust_breakdown',
    label: "I didn't trust the salesperson",
    cardDescription: 'Something felt rushed, vague, or pressured.',
    Icon: ShieldAlert,
    accent: 'text-blue-700',
    accentBg: 'bg-blue-50',
    accentBorder: 'border-blue-200',
    reflectionTitle: 'We hear you.',
    reflectionBody:
      'A pushy or unclear salesperson can ruin an otherwise good quote. You deserve a process that feels safe, honest, and pressure-free.',
    secondaryQuestion: 'What made you uncomfortable?',
    secondaryOptions: [
      'They were pushy',
      "Didn't answer my questions",
      'Kept changing the price',
      'Felt salesy, not helpful',
      "Didn't trust their explanations",
      'Rushed me',
    ],
    prescriptionSetup:
      'Understood. Your next estimate will be built with full transparency and zero pressure. No scripts. No manipulation. Just facts.',
    prescriptionHeadline: 'Your Estimate, Pressure-Free.',
    prescriptionSubhead:
      "We handle the contractor conversation so you never deal with a high-pressure sales rep again.",
    guaranteeTitle: 'No-Pressure Guarantee',
    guarantees: [
      'No in-home sales pitch required',
      'Your WindowMan advisor handles the contractor relationship',
      'All pricing and terms in writing before any commitment',
      'You can walk away at any point—no follow-up calls',
    ],
    ctaText: 'Get my no-pressure estimate',
    prescriptionPath: 'transparency_no_pressure',
  },
  financial: {
    code: 'financial',
    label: "I can't afford that price structure",
    cardDescription: 'The deposit, financing, or payment terms felt wrong.',
    Icon: CreditCard,
    accent: 'text-green-700',
    accentBg: 'bg-green-50',
    accentBorder: 'border-green-200',
    reflectionTitle: 'We hear you.',
    reflectionBody:
      "Wanting to improve your home but feeling boxed in by the price structure is stressful. You deserve options that fit your life, not the contractor's agenda.",
    secondaryQuestion: "What part of the cost structure didn't work?",
    secondaryOptions: [
      'Down payment too big',
      'Need more flexible options',
      'Want to compare payment plans',
    ],
    prescriptionSetup:
      "Got it. We'll build an estimate with flexible payment paths and real financing options—not the one-size-fits-all plan you were shown.",
    prescriptionHeadline: 'Your Estimate, With Options That Actually Fit.',
    prescriptionSubhead:
      "Multiple payment paths side by side so you can pick what works for your budget.",
    guaranteeTitle: 'Flexible Financing Guarantee',
    guarantees: [
      'Multiple financing partners compared, not just one',
      'Phased-project pricing if full scope is out of budget',
      'No high-pressure financing upsells at the table',
      'Clear APR and total-cost-of-ownership on every option',
    ],
    ctaText: 'Show me my payment options',
    prescriptionPath: 'financing_flexible',
  },
  timing: {
    code: 'timing',
    label: "The timing isn't right",
    cardDescription: 'The deadline, urgency, or install timing felt off.',
    Icon: Clock,
    accent: 'text-amber-700',
    accentBg: 'bg-amber-50',
    accentBorder: 'border-amber-200',
    reflectionTitle: 'We hear you.',
    reflectionBody:
      "Window projects are big decisions, and timing matters. You deserve an estimate that respects your pace—not someone else's deadline.",
    secondaryQuestion: "What about the timing didn't feel right?",
    secondaryOptions: [
      "Not ready to start",
      'Need to plan financially',
      "Comparing options",
      "Overwhelmed",
      'Need more information first',
    ],
    prescriptionSetup:
      "Understood. We'll build an estimate that gives you clarity without pressure—something you can revisit when the timing is right.",
    prescriptionHeadline: 'Your Estimate, On Your Timeline.',
    prescriptionSubhead:
      "Today's pricing locked in so you can review at your pace—no expiration games.",
    guaranteeTitle: 'No-Rush Guarantee',
    guarantees: [
      "Today's pricing held for 60 days—no artificial urgency",
      'No follow-up calls unless you request them',
      'Side-by-side comparison tools for when you return',
      'Your advisor reachable whenever you have questions',
    ],
    ctaText: 'Get clarity, no pressure',
    prescriptionPath: 'timing_no_rush',
  },
  scope_mismatch: {
    code: 'scope_mismatch',
    label: "It wasn't what I actually wanted",
    cardDescription: 'The scope or product mix did not match your goal.',
    Icon: LayoutGrid,
    accent: 'text-orange-700',
    accentBg: 'bg-orange-50',
    accentBorder: 'border-orange-200',
    reflectionTitle: 'We hear you.',
    reflectionBody:
      "When a quote doesn't match your vision, it's frustrating. You deserve an estimate built around your home, not a template.",
    secondaryQuestion: "What didn't match what you wanted?",
    secondaryOptions: [
      "Didn't include what I asked for",
      'Too many upsells',
      "Didn't feel tailored to my home",
    ],
    prescriptionSetup:
      "Got it. We'll rebuild your estimate from scratch based on what you actually want—no upsells, no assumptions, no shortcuts.",
    prescriptionHeadline: 'Your Estimate, Built Around Your Home.',
    prescriptionSubhead:
      "We scope the project to what you asked for—then let contractors quote that spec, not their own.",
    guaranteeTitle: 'Scope-Accuracy Guarantee',
    guarantees: [
      'Your stated scope is the quote spec—non-negotiable',
      'Contractors bid against your requirements, not theirs',
      'No bundled upsells or "while we\'re there" additions',
      'Line-level approval on every change before it happens',
    ],
    ctaText: 'Build my right-scoped estimate',
    prescriptionPath: 'scope_custom',
  },
  other: {
    code: 'other',
    label: 'Something else felt off',
    cardDescription: 'Something felt wrong, even if it is hard to name.',
    Icon: MessageCircle,
    accent: 'text-slate-700',
    accentBg: 'bg-slate-50',
    accentBorder: 'border-slate-200',
    reflectionTitle: 'We hear you.',
    reflectionBody:
      "Something about that quote didn't sit right—and that matters. You deserve an estimate that feels clear, fair, and aligned with your goals.",
    secondaryQuestion: 'Tell us what felt off.',
    secondaryOptions: [],
    prescriptionSetup:
      "Thank you. We'll take what you shared and build an estimate that avoids those issues entirely.",
    prescriptionHeadline: 'Your Estimate, Done Right This Time.',
    prescriptionSubhead:
      "We'll use your feedback to shape a quote that addresses exactly what went wrong.",
    guaranteeTitle: 'Full-Context Rebuild Guarantee',
    guarantees: [
      'Your concerns captured and shared with the contractor upfront',
      'Quote reviewed against your specific feedback before delivery',
      'Your advisor stays engaged through installation',
      'Walk away any time—no obligations, ever',
    ],
    ctaText: 'Build my better estimate',
    prescriptionPath: 'custom_rebuild',
  },
  not_sure: {
    code: 'not_sure',
    label: 'I don’t know — guide me',
    cardDescription: 'Use the report to choose the safest next move for me.',
    Icon: HelpCircle,
    accent: 'text-blue-700',
    accentBg: 'bg-blue-50',
    accentBorder: 'border-blue-200',
    reflectionTitle: 'WindowMan will guide it.',
    reflectionBody:
      'That is exactly why WindowMan exists. You do not need to diagnose the quote yourself — we’ll use the report to guide the safest next move.',
    secondaryQuestion: 'What would help you feel safer?',
    secondaryOptions: [
      'Show me the biggest risk',
      'Help me compare options',
      'Tell me what to ask next',
      'Find me a cleaner quote',
    ],
    prescriptionSetup:
      'Got it. We’ll use your report findings to choose the safest path forward instead of making you guess.',
    prescriptionHeadline: 'WindowMan-Guided Next Move',
    prescriptionSubhead:
      'We’ll use your report findings to choose the safest path forward.',
    guaranteeTitle: 'Guided Decision Guarantee',
    guarantees: [
      'Your report findings drive the next step',
      'The biggest risk gets handled first',
      'You get a cleaner comparison path',
      'No guessing and no pressure to self-diagnose',
    ],
    ctaText: 'Guide my next move',
    prescriptionPath: 'guided_next_move',
  },
};

export const DIAGNOSIS_ORDER: DiagnosisCode[] = [
  'price_shock',
  'trust_breakdown',
  'financial',
  'timing',
  'scope_mismatch',
  'other',
  'not_sure',
];
