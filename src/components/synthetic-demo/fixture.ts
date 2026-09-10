import type { DemoSignal, SyntheticDemoVariant } from "./types";

/** Educational evidence shared by every renderer; never a visitor analysis. */
export const SAMPLE_QUOTE = {
  id: "windowman_sample_quote_v1",
  title: "Illustrative window estimate",
  disclosure: "Synthetic sample. Not your quote. Not a real contractor quote. Names and details are fictional.",
  shortDisclosure: "Sample — not your quote",
  openings: 6,
  lines: [
    { description: "Remove existing windows (6)", amountCents: 180000 },
    { description: "Install new double-pane windows (6)", amountCents: 942000 },
    { description: "Interior trim and caulk", amountCents: 126000 },
    { description: "Clean up and haul away", amountCents: 45000 },
  ],
  totalCents: 1293000,
  signals: [
    {
      id: "scope", label: "Installation scope", quote: "Install new double-pane windows (6)",
      finding: "Install detail missing",
      explanation: "The sample names the windows, but leaves the installation method unclear.",
      question: "What flashing and sealant system is included?",
      challenge: "The quote says ‘install new windows.’ What would you ask?",
      answers: [
        { id: "clarify", label: "Ask for the installation details", detail: "Get the method and materials in writing.", coaching: "Make the installation method part of the written scope." },
        { id: "assume", label: "Assume everything is included", detail: "Trust that the headline covers the work.", coaching: "A product name does not define the installation. Ask what is included." },
        { id: "later", label: "Wait until installation day", detail: "Ask the crew when they arrive.", coaching: "Resolve the installation scope while you can still compare estimates." },
      ],
    },
    {
      id: "warranty", label: "Warranty labor", quote: "Manufacturer warranty applies.",
      finding: "Labor coverage missing",
      explanation: "Product coverage and the cost of installation repairs are separate questions.",
      question: "Who covers repair labor, for how long, and with what exclusions?",
      challenge: "The quote says ‘manufacturer warranty.’ What is still unclear?",
      answers: [
        { id: "clarify", label: "Who pays for repair labor", detail: "Ask about duration and exclusions too.", coaching: "Separate product coverage from installation and repair labor." },
        { id: "assume", label: "Nothing — warranty means covered", detail: "Treat product and labor as the same.", coaching: "A product warranty may leave labor costs separate. Ask for both." },
        { id: "later", label: "I can check if something breaks", detail: "Save that question for later.", coaching: "Written labor terms help you compare coverage before committing." },
      ],
    },
    {
      id: "fees", label: "Permit fees", quote: "Permit fees as needed.",
      finding: "Permit fee not stated",
      explanation: "The sample leaves the fee open. Clarify the amount and who is responsible.",
      question: "What is the permit fee, and is it included in the written total?",
      challenge: "The quote says ‘permit fees as needed.’ What would you do?",
      answers: [
        { id: "clarify", label: "Ask for the exact fee", detail: "Get the actual permit cost in writing.", coaching: "Get every fee written into the scope." },
        { id: "assume", label: "Assume it is included", detail: "Move forward without asking.", coaching: "‘As needed’ leaves the price open. Ask whether the fee is included." },
        { id: "later", label: "Sign and sort it out later", detail: "Deal with it if it becomes a problem.", coaching: "Clarify open fees before signing so you can compare complete totals." },
      ],
    },
  ] satisfies readonly DemoSignal[],
} as const;

export const VARIANT_TITLES: Record<SyntheticDemoVariant, string> = {
  xray: "Sample quote X-Ray",
  lens: "Sample Quote Lens",
  challenge: "Quote Challenge",
};
export function isSyntheticDemoVariant(value: unknown): value is SyntheticDemoVariant {
  return value === "xray" || value === "lens" || value === "challenge";
}
