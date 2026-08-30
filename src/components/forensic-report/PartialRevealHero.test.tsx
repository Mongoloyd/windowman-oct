import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisData } from "@/hooks/useAnalysisData";
import ForensicAuditReport from "./ForensicAuditReport";
import PartialRevealHero from "./PartialRevealHero";
import ReportClassicDarkV2Partial from "./ReportClassicDarkV2Partial";

const HERO_PROPS = {
  contractorName: "Coastal Fortress Windows & Doors",
  documentType: "quote",
  pageCount: 3,
  openingCount: 10,
  lineItemCount: 24,
  flagRedCount: 5,
  flagAmberCount: 7,
} as const;

function buildAnalysisData(overrides: Partial<AnalysisData> = {}): AnalysisData {
  return {
    analysisId: "preview-analysis",
    grade: "D",
    flags: [],
    flagCount: 12,
    flagRedCount: 5,
    flagAmberCount: 7,
    contractorName: "Coastal Fortress Windows & Doors",
    confidenceScore: 0.93,
    pillarScores: [
      { key: "safety_code", label: "Safety & Code", score: 35, status: "fail" },
      { key: "install_scope", label: "Installation Scope", score: 60, status: "fail" },
      { key: "price_fairness", label: "Price Clarity", score: 90, status: "pass" },
      { key: "fine_print", label: "Fine Print", score: 70, status: "warn" },
      { key: "warranty", label: "Warranty Coverage", score: 65, status: "warn" },
    ],
    documentType: "quote",
    pageCount: 3,
    openingCount: 10,
    lineItemCount: 24,
    qualityBand: "poor",
    hasWarranty: true,
    hasPermits: false,
    analysisStatus: "preview_ready",
    pricePerOpeningBand: "market",
    summaryTeaser: "Preview-safe summary.",
    ...overrides,
  };
}

describe("PartialRevealHero evidence summary", () => {
  it("proves the document was read using only safe preview facts", () => {
    render(<PartialRevealHero {...HERO_PROPS} />);

    const summary = screen.getByLabelText("Document evidence summary");
    expect(within(summary).getByText("Evidence Summary")).toBeInTheDocument();
    expect(summary).toHaveTextContent(
      "We read Coastal Fortress Windows & Doors’s quote and found 12 items worth reviewing before you sign.",
    );
    expect(summary).toHaveTextContent("10openings detected");
    expect(summary).toHaveTextContent("3pages read");
    expect(summary).toHaveTextContent("24quoted line items parsed");
    expect(summary).toHaveTextContent("Specific findings unlock after verification.");
  });

  it("removes the unreliable pillar grid and dominant grade without changing the surrounding funnel", () => {
    render(<PartialRevealHero {...HERO_PROPS} />);

    expect(screen.queryByRole("list", { name: /five-pillar/i })).not.toBeInTheDocument();
    for (const formerStatus of ["Pending", "Material Concern", "Clarification Needed", "Clear"]) {
      expect(screen.queryByText(formerStatus, { exact: true })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Quote grade D")).not.toBeInTheDocument();
    expect(screen.queryByText("Audit Verdict · Quote Grade")).not.toBeInTheDocument();
    expect(screen.getByText("Quote Analysis Preview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your Quote Analysis Preview" })).toBeInTheDocument();
    expect(screen.queryByText(/Forensic Audit · Preview Locked/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Scan Complete · Case File Created")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Unlock Your Private Truth Report" }),
    ).not.toBeInTheDocument();
  });

  it("omits unresolved facts instead of rendering broken placeholders", () => {
    render(
      <PartialRevealHero
        {...HERO_PROPS}
        contractorName="   "
        documentType={null}
        pageCount={0}
        openingCount={Number.NaN}
        lineItemCount={-2}
      />,
    );

    const summary = screen.getByLabelText("Document evidence summary");
    expect(summary).toHaveTextContent(
      "We read this quote and found 12 items worth reviewing before you sign.",
    );
    expect(within(summary).queryByLabelText("Detected document facts")).not.toBeInTheDocument();
    expect(summary).not.toHaveTextContent(/unknown|undefined|nan|0 openings/i);
  });

  it("keeps the evidence panel static and free of false interaction affordances", () => {
    render(<PartialRevealHero {...HERO_PROPS} />);

    const summary = screen.getByLabelText("Document evidence summary");
    expect(within(summary).queryByRole("button")).not.toBeInTheDocument();
    expect(within(summary).queryByRole("link")).not.toBeInTheDocument();
    expect(summary).not.toHaveAttribute("tabindex");
  });

  it("preserves the aggregate metrics and objective disclaimer", () => {
    render(<PartialRevealHero {...HERO_PROPS} />);

    expect(screen.getByText("Material Quote Concerns").parentElement).toHaveTextContent(
      "5Material Quote Concerns",
    );
    expect(screen.getByText("Pricing & Scope Review").parentElement).toHaveTextContent(
      "Analysis ReadyPricing & Scope Review",
    );
    expect(screen.getByText("Clarifications Needed").parentElement).toHaveTextContent(
      "7Clarifications Needed",
    );
    expect(screen.getByText("Clarifications Needed").parentElement).toHaveClass(
      "fr-tile--warning",
    );
    expect(
      screen.getByText(
        "This review evaluates what is documented in this quote. It does not grade the contractor’s workmanship, reputation, or professional quality. A missing item means it was omitted from the document—not necessarily from the contractor’s planned work. It does not verify legal compliance, engineering suitability, installed conditions, or whether the quote is safe to sign.",
      ),
    ).toBeInTheDocument();
  });

  it("pluralizes each severity tile from its own aggregate count", () => {
    const { rerender } = render(
      <PartialRevealHero {...HERO_PROPS} flagRedCount={1} flagAmberCount={1} />,
    );

    expect(screen.getByText("Material Quote Concern").parentElement).toHaveTextContent(
      "1Material Quote Concern",
    );
    expect(screen.getByText("Clarification Needed").parentElement).toHaveTextContent(
      "1Clarification Needed",
    );

    rerender(<PartialRevealHero {...HERO_PROPS} flagRedCount={2} flagAmberCount={3} />);

    expect(screen.getByText("Material Quote Concerns").parentElement).toHaveTextContent(
      "2Material Quote Concerns",
    );
    expect(screen.getByText("Clarifications Needed").parentElement).toHaveTextContent(
      "3Clarifications Needed",
    );
  });
});

describe("evidence-summary prop plumbing", () => {
  it("passes the safe proof-of-read fields through the partial report path", () => {
    render(
      <ReportClassicDarkV2Partial
        analysisData={buildAnalysisData()}
        county="Broward"
      />,
    );

    const summary = screen.getByLabelText("Document evidence summary");
    expect(summary).toHaveTextContent("Coastal Fortress Windows & Doors’s quote");
    expect(summary).toHaveTextContent("10openings detected");
    expect(summary).toHaveTextContent("3pages read");
    expect(summary).toHaveTextContent("24quoted line items parsed");
    const bento = screen.getByLabelText("Quote analysis snapshot");
    expect(within(bento).getByRole("img", { name: "Quote price band: Typical" })).toBeInTheDocument();
    expect(screen.getByText("Warranty terms").parentElement).toHaveTextContent(
      "Warranty termsMentioned in quote",
    );
    expect(screen.getByText("Permit language").parentElement).toHaveTextContent(
      "Permit languageNot documented in quote",
    );
    expect(bento).toHaveTextContent("We analyzed Coastal Fortress Windows & Doors’s estimate.");
    expect(bento).toHaveTextContent("Safety & Code");
    expect(bento).toHaveTextContent("Installation Scope");
    expect(bento).not.toHaveTextContent(
      /35|60|90|70|65/,
    );
    expect(screen.queryByText(/we found 12 review items/i)).not.toBeInTheDocument();
  });

  it("rejects hostile extras and preserves the existing send-code callback", () => {
    const onSendCode = vi.fn();
    const hostileAnalysis = {
      ...buildAnalysisData(),
      full_json: "LEAKED_FULL_JSON_SENTINEL",
      raw_line_items: "LEAKED_LINE_ITEMS_SENTINEL",
      exact_total: "$14,500",
      phone: "561-123-4567",
    } as AnalysisData & Record<string, unknown>;

    const { container } = render(
      <ReportClassicDarkV2Partial
        analysisData={hostileAnalysis}
        county="Broward"
        gateProps={{
          gateMode: "send_code",
          otpValue: "",
          onOtpChange: vi.fn(),
          onOtpSubmit: vi.fn(),
          onSendCode,
          isLoading: false,
          errorMsg: "",
          resendCooldown: 0,
          onResend: vi.fn(),
        }}
      />,
    );

    expect(container).not.toHaveTextContent(
      /LEAKED_FULL_JSON_SENTINEL|LEAKED_LINE_ITEMS_SENTINEL|\$14,500|561-123-4567/,
    );
    expect(screen.getByText("Review your full 5-pillar analysis and scope breakdown.")).toBeInTheDocument();
    expect(screen.getByText("QUOTE READINESS REVIEW")).toBeInTheDocument();
    expect(screen.getByText("Quote Analysis Snapshot")).toBeInTheDocument();
    expect(screen.getAllByText("Locked Review Item")).toHaveLength(3);
    expect(
      screen.getByText("Material concerns and clarifications were identified in this quote"),
    ).toHaveClass("text-sm");
    expect(screen.getByText("LOCKED · VERIFICATION REQUIRED")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Verify your phone number to unlock what was found, why it matters, and the exact questions to ask before signing.",
      ),
    ).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "Send secure code" }));
    expect(onSendCode).toHaveBeenCalledTimes(1);
  });

  it("leaves the full-report presentation unchanged", () => {
    render(
      <ForensicAuditReport
        accessLevel="full"
        analysisId="full-analysis"
        grade="D"
        confidenceScore={93}
        flagRedCount={5}
        flagAmberCount={7}
      />,
    );

    expect(screen.queryByLabelText("Document evidence summary")).not.toBeInTheDocument();
    expect(screen.getByText("Case File Unlocked")).toBeInTheDocument();
    expect(screen.getByText("Evidence Behind the Grade")).toBeInTheDocument();
    expect(screen.getByText("THE FORENSIC VERDICT")).toBeInTheDocument();
  });
});
