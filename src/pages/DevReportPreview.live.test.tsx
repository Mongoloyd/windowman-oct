import { render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAnalysisPreview } from "@/services/reportService";
import DevReportPreview from "./DevReportPreview";

vi.mock("@/services/reportService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/reportService")>();
  return {
    ...actual,
    fetchAnalysisPreview: vi.fn(),
  };
});

const SCAN_SESSION_ID = "b229f2fb-28b5-4855-941b-9b71dceefa2f";

describe("DevReportPreview live preview plumbing", () => {
  beforeEach(() => {
    vi.mocked(fetchAnalysisPreview).mockResolvedValue({
      ok: true,
      data: {
        analysis_id: "4f7c5fa7-a393-46c4-8d7e-52b465ff25c8",
        grade: "D",
        flag_count: 19,
        flag_red_count: 9,
        flag_amber_count: 10,
        proof_of_read: {
          contractor_name: "brightview window",
          document_type: "estimate",
          opening_count: 14,
          page_count: 1,
          line_item_count: 3,
        },
        preview_json: {
          price_per_opening_band: "low",
          has_warranty: false,
          has_permits: false,
          pillar_scores: {
            safety_code: { status: "fail" },
            install_scope: { status: "fail" },
            price_fairness: { status: "pass" },
            fine_print: { status: "fail" },
            warranty: { status: "warn" },
          },
        },
        confidence_score: 0.92,
        document_type: "estimate",
        rubric_version: "test",
      },
    });
  });

  it("passes live qualitative pillars and documentation signals into the partial report", async () => {
    render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={[
            `/dev/report-preview?v=v3&mode=preview&source=live&scan_session_id=${SCAN_SESSION_ID}`,
          ]}
        >
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );

    const bento = await screen.findByLabelText("Quote analysis snapshot");
    expect(within(bento).queryByText(/Category-level review is not available/i)).not.toBeInTheDocument();
    expect(within(bento).getByText("Safety & Code")).toBeInTheDocument();
    expect(within(bento).getByText("Installation Scope")).toBeInTheDocument();
    expect(within(bento).getByText(/We analyzed Brightview Window’s estimate/)).toBeInTheDocument();
    expect(within(bento).getByText("Warranty terms").parentElement).toHaveTextContent(
      "Not documented in quote",
    );
    expect(within(bento).getByText("Permit language").parentElement).toHaveTextContent(
      "Not documented in quote",
    );
    expect(within(bento).getByRole("img", { name: "Quote price band: Lower" })).toBeInTheDocument();
  });

  it("fails malformed live pillar data closed instead of promoting it to clear", async () => {
    vi.mocked(fetchAnalysisPreview).mockResolvedValueOnce({
      ok: true,
      data: {
        analysis_id: null,
        grade: "D",
        flag_count: 1,
        flag_red_count: 1,
        flag_amber_count: 0,
        proof_of_read: { contractor_name: null },
        preview_json: {
          pillar_scores: { safety_code: { status: "unexpected" } },
          has_warranty: "false",
          has_permits: null,
        },
        confidence_score: null,
        document_type: "estimate",
        rubric_version: null,
      },
    });

    render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={[
            `/dev/report-preview?v=v3&mode=preview&source=live&scan_session_id=${SCAN_SESSION_ID}`,
          ]}
        >
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );

    const bento = await screen.findByLabelText("Quote analysis snapshot");
    expect(within(bento).getByText(/Category-level review is not available/i)).toBeInTheDocument();
    expect(within(bento).queryByText("Warranty terms")).not.toBeInTheDocument();
    expect(within(bento).queryByText("Permit language")).not.toBeInTheDocument();
    expect(within(bento).queryByText(/appear clear/i)).not.toBeInTheDocument();
  });
});
