import type { DiagnosisCode } from "../../types";
import {
  comparisonCard,
  comparisonProblemCol,
  comparisonRequirementCol,
  sectionGap,
  sectionHeadline,
  sectionLabel,
} from "./prescriptionTokens";

export interface ComparisonRow {
  problem: string;
  requirement: string;
}

const MAX_ROWS = 4;
const MIN_ROWS = 2;

const BRANCH_FALLBACK_ROWS: Record<DiagnosisCode, ComparisonRow[]> = {
  price_shock: [
    {
      problem: "Price feels inflated or hard to justify",
      requirement: "Ask for itemized pricing and compare each line to market benchmarks",
    },
    {
      problem: "Hidden fees or bundled charges",
      requirement: "Require a written breakdown with no miscellaneous padding",
    },
    {
      problem: "Hard to verify fair value",
      requirement: "Use your current quote as leverage, not a final answer",
    },
  ],
  trust_breakdown: [
    {
      problem: "Sales pressure or vague explanations",
      requirement: "Ask for written terms before any commitment",
    },
    {
      problem: "Contractor credibility feels uncertain",
      requirement: "Request proof of license, insurance, and references in writing",
    },
    {
      problem: "Terms may shift after signing",
      requirement: "Lock scope and pricing language before you pay a deposit",
    },
  ],
  financial: [
    {
      problem: "Down payment feels too high",
      requirement: "Ask for lower upfront payment or a phased deposit schedule",
    },
    {
      problem: "Monthly payment does not fit budget",
      requirement: "Compare monthly payment and total cost across financing options",
    },
    {
      problem: "Payment terms create leverage against you",
      requirement: "Require written cancellation and payment timing before money changes hands",
    },
  ],
  timing: [
    {
      problem: "Timeline feels rushed or unclear",
      requirement: "Ask for written start and completion dates before signing",
    },
    {
      problem: "Artificial urgency on the quote",
      requirement: "Request price hold terms that match your decision pace",
    },
    {
      problem: "Not ready to commit yet",
      requirement: "Use the report to compare options without pressure to sign now",
    },
  ],
  scope_mismatch: [
    {
      problem: "Scope does not match what you asked for",
      requirement: "Require a written scope list before accepting the next quote",
    },
    {
      problem: "Upsells or extras feel bundled in",
      requirement: "Ask contractors to bid your spec, not their template",
    },
    {
      problem: "Product mix may not fit your home",
      requirement: "Confirm product series and opening schedule in writing",
    },
  ],
  other: [
    {
      problem: "Something still feels off about the quote",
      requirement: "Address your specific concern in writing before signing",
    },
    {
      problem: "Terms are hard to compare",
      requirement: "Use WindowMan's report to shape a cleaner competing quote",
    },
  ],
  not_sure: [
    {
      problem: "Unclear what the biggest risk is",
      requirement: "Start with the report's top signing risks before price shopping",
    },
    {
      problem: "Hard to know what to ask next",
      requirement: "Let your advisor translate report findings into quote requirements",
    },
    {
      problem: "Need a safer comparison path",
      requirement: "Compare at least two quotes against the same written scope",
    },
  ],
};

function insightToRequirement(insight: string): string {
  const lower = insight.toLowerCase();
  if (lower.includes("warranty")) {
    return "Ask for enforceable warranty responsibilities in writing";
  }
  if (lower.includes("permit")) {
    return "Require written permit handling before signing";
  }
  if (lower.includes("noa") || lower.includes("approval") || lower.includes("dp")) {
    return "Ask for written NOA/DP proof for every proposed product";
  }
  if (lower.includes("price") || lower.includes("payment") || lower.includes("deposit")) {
    return "Compare monthly payment and total cost side by side";
  }
  if (lower.includes("scope") || lower.includes("install") || lower.includes("labor")) {
    return "Require written scope before signing";
  }
  return "Address this in writing before accepting the next quote";
}

function clarifierToRequirement(clarifier: string): string {
  const lower = clarifier.toLowerCase();
  if (lower.includes("down payment")) {
    return "Ask for lower upfront payment or phased deposit";
  }
  if (lower.includes("financ") || lower.includes("payment")) {
    return "Compare monthly payment and total cost across options";
  }
  if (lower.includes("pushy") || lower.includes("trust") || lower.includes("sales")) {
    return "Require written terms and a no-pressure review path";
  }
  return "Clarify this requirement in your next quote conversation";
}

export function buildComparisonRows(input: {
  topInsights: string[];
  primaryDiagnosis: DiagnosisCode;
  mainConcernLabel: string;
  secondaryClarifiers: string[];
  desiredNextMove: string[];
}): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const seen = new Set<string>();

  const pushRow = (problem: string, requirement: string) => {
    const key = problem.toLowerCase().trim();
    if (!key || seen.has(key) || rows.length >= MAX_ROWS) return;
    seen.add(key);
    rows.push({ problem, requirement });
  };

  for (const insight of input.topInsights) {
    const trimmed = insight.trim();
    if (trimmed) pushRow(trimmed, insightToRequirement(trimmed));
  }

  if (rows.length < MAX_ROWS && input.mainConcernLabel.trim()) {
    pushRow(
      input.mainConcernLabel.trim(),
      "Shape the next quote around this concern before you sign",
    );
  }

  for (const clarifier of input.secondaryClarifiers) {
    pushRow(clarifier, clarifierToRequirement(clarifier));
  }

  for (const move of input.desiredNextMove) {
    pushRow(
      `You want to: ${move}`,
      "Make this an explicit requirement in the next quote conversation",
    );
  }

  if (rows.length < MIN_ROWS) {
    for (const fallback of BRANCH_FALLBACK_ROWS[input.primaryDiagnosis]) {
      pushRow(fallback.problem, fallback.requirement);
      if (rows.length >= MIN_ROWS) break;
    }
  }

  if (rows.length < MIN_ROWS) {
    pushRow(
      "Quote terms still need confirmation",
      "Use your report findings to ask for written terms before signing",
    );
    pushRow(
      "Next quote may repeat the same gaps",
      "Require scope, warranty, and payment clarity in the competing estimate",
    );
  }

  return rows.slice(0, MAX_ROWS);
}

interface QuoteComparisonBlockProps {
  topInsights: string[];
  primaryDiagnosis: DiagnosisCode;
  mainConcernLabel: string;
  secondaryClarifiers: string[];
  desiredNextMove: string[];
}

export function QuoteComparisonBlock({
  topInsights,
  primaryDiagnosis,
  mainConcernLabel,
  secondaryClarifiers,
  desiredNextMove,
}: QuoteComparisonBlockProps) {
  const rows = buildComparisonRows({
    topInsights,
    primaryDiagnosis,
    mainConcernLabel,
    secondaryClarifiers,
    desiredNextMove,
  });

  if (rows.length === 0) return null;

  return (
    <div className={`${comparisonCard} ${sectionGap} p-7 md:p-9`}>
      <p className={`${sectionLabel} mb-2`}>Quote Strategy</p>
      <h3 className={`${sectionHeadline} text-xl md:text-2xl lg:text-[1.65rem] mb-6`}>
        Current Quote Problem vs Better Quote Requirement
      </h3>

      <div className="hidden md:grid md:grid-cols-2 gap-3 mb-3 px-1">
        <p className={`${sectionLabel} text-[10px]`}>Current Quote Problem</p>
        <p className={`${sectionLabel} text-[10px]`}>Better Quote Requirement</p>
      </div>

      <div className="space-y-3 md:space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.problem}
            className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3"
          >
            <div className={comparisonProblemCol}>
              <p className={`${sectionLabel} mb-2 text-[10px] md:hidden`}>Current Quote Problem</p>
              <p className="text-sm md:text-[0.95rem] font-bold text-slate-900 leading-snug">{row.problem}</p>
            </div>
            <div className={comparisonRequirementCol}>
              <p className={`${sectionLabel} mb-2 text-[10px] md:hidden`}>Better Quote Requirement</p>
              <p className="text-sm md:text-[0.95rem] text-slate-700 leading-relaxed">{row.requirement}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
