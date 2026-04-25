import type { DiagnosisCode } from '../types';

// COUNTER-OFFER CHIPS — branch-dynamic "what would get you to yes" terms
// Each term is a specific business condition the advisor can pre-negotiate
export const BRANCH_DYNAMIC_CHIPS: Record<DiagnosisCode, string[]> = {
  price_shock: [
    'Lower the total project cost',
    'Remove hidden service fees',
    'Match a lower competitor bid',
    'Provide a line-item breakdown',
    "Apply a 'First-Time' discount",
  ],
  trust_breakdown: [
    'Switch to a higher-rated company',
    'See proof of insurance & license',
    'Talk to a local reference',
    'No in-home high-pressure sales',
    'Written 10-year labor warranty',
  ],
  financial: [
    'Zero-down financing options',
    'Lower the monthly payment',
    'Extend the financing term',
    'Delayed first payment (90 days)',
    'Split project into two phases',
  ],
  timing: [
    'Lock this price for 60 days',
    'Guaranteed installation date',
    'Just send info, no phone calls',
    'Start in 3+ months',
    'Compare with 2 more quotes first',
  ],
  scope_mismatch: [
    'Change the window material',
    'Simplify the installation scope',
    "Remove 'extra' features",
    'Focus only on priority windows',
    'Include hurricane-rated glass',
  ],
  other: [
    'Better price',
    'Different company',
    'More options',
    'Custom request',
  ],
  not_sure: [
    'Show me the biggest risk',
    'Help me compare options',
    'Tell me what to ask next',
    'Find me a cleaner quote',
  ],
};

// CONDITIONAL-CLOSE STATEMENT GENERATOR
// Turns the user's chip selections into a first-person commitment sentence
export const generateConditionalStatement = (
  diagnosisLabel: string,
  selectedChips: string[]
): string => {
  if (selectedChips.length === 0) {
    return "Select what would get you to 'yes' above…";
  }
  const terms = selectedChips.join(', ').replace(/, ([^,]*)$/, ' and $1');
  return `"If WindowMan can secure a deal that addresses ${diagnosisLabel.toLowerCase()} and specifically includes ${terms.toLowerCase()}, I am ready to move forward."`;
};
