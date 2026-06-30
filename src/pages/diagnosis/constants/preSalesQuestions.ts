/** Pre-sales intelligence options — Phase 1 diagnosis (not document-derived). */

export const URGENCY_MOTIVATION_OPTIONS = [
  'Hurricane season',
  'Insurance pressure',
  'Security',
  'Noise',
  'Energy bills',
  'Old windows failing',
  'Contractor gave me a quote',
  'HOA / condo requirement',
] as const;

export const TIMELINE_OPTIONS = [
  'Today / this week',
  'Within 2 weeks',
  'This month',
  'Before storm season',
  'Still researching',
] as const;

export const DECISION_AUTHORITY_OPTIONS = [
  'Just me',
  'Spouse / partner',
  'Parent / family',
  'HOA / condo board',
  "I'm helping someone else",
] as const;

export const CONTRACTOR_CONTEXT_OPTIONS = [
  'They are pressuring me to sign',
  'I liked them but want a second opinion',
  'Something felt vague',
  'Price felt high',
  'I have multiple quotes',
  'I have not spoken to anyone yet',
] as const;

export const DESIRED_NEXT_MOVE_OPTIONS = [
  'Understand this quote',
  'Find missing items',
  'Compare against fair pricing',
  'Prepare questions for the contractor',
  'Get a better competing quote',
  'Talk to someone before signing',
] as const;

export const PRESALES_QUESTION_COPY = {
  urgency: {
    eyebrow: 'Motivation',
    title: 'What made you start looking at impact windows now?',
    subtitle: 'Tap everything that applies.',
  },
  timeline: {
    eyebrow: 'Timeline',
    title: 'When are you hoping to make a decision?',
    subtitle: 'Pick the closest answer.',
  },
  authority: {
    eyebrow: 'Decision Makers',
    title: 'Who else needs to weigh in?',
    subtitle: 'Pick one.',
  },
  contractor: {
    eyebrow: 'Contractor Context',
    title: 'What happened with the contractor who gave you this quote?',
    subtitle: 'Tap everything that applies.',
  },
  nextMove: {
    eyebrow: 'Your Goal',
    title: 'What do you want WindowMan to help you do next?',
    subtitle: 'Tap everything that applies.',
  },
} as const;

/** Prefixes for secondary_clarifiers.codes semantic remap at submit. */
export const CLARIFIER_PREFIX = {
  contractor: 'Contractor: ',
  goal: 'Goal: ',
} as const;
