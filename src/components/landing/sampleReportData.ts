export type SampleReportStatus =
  | "Needs Clarification"
  | "Needs Review"
  | "Strong Next Step"
  | "Review Before Signing";

export type SampleReportCard = {
  id: string;
  title: string;
  status: SampleReportStatus;
  copy: string;
};

export const sampleReportCards: SampleReportCard[] = [
  {
    id: "quote-summary",
    title: "Quote Summary",
    status: "Needs Clarification",
    copy: "The sample estimate includes a total project price, but several assumptions need written clarification before a homeowner can compare it fairly.",
  },
  {
    id: "risk-signals",
    title: "Risk Signals",
    status: "Needs Review",
    copy: "Payment timing, change-order language, and vague exclusions may deserve a second look before signing.",
  },
  {
    id: "missing-scope",
    title: "Missing Scope",
    status: "Needs Clarification",
    copy: "A report may flag unclear responsibility for stucco repair, trim, paint, disposal, cleanup, or buck work.",
  },
  {
    id: "questions-to-ask",
    title: "Questions to Ask",
    status: "Strong Next Step",
    copy: "Ask whether permit fees, inspection corrections, finishing work, and warranty responsibilities are included in writing.",
  },
  {
    id: "next-step",
    title: "Next Step",
    status: "Review Before Signing",
    copy: "The goal is not panic. The goal is apples-to-apples clarity before a high-ticket decision.",
  },
];
