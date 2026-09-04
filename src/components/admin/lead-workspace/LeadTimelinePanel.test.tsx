import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { LeadTimelinePanel } from "./LeadTimelinePanel";

vi.mock("@/services/adminDataService", () => ({
  fetchLeadEvents: vi.fn(async () => [{
    id: "event-1",
    lead_id: "lead-1",
    event_name: "scan_complete",
    event_source: "scanner",
    event_id: null,
    status: null,
    scan_session_id: null,
    analysis_id: null,
    opportunity_id: null,
    voice_followup_id: null,
    metadata: { grade: "B" },
    created_at: "2026-01-01T12:00:00Z",
  }]),
  getErrorMessage: (error: unknown) => String(error),
}));

describe("LeadTimelinePanel", () => {
  it("keeps the event summary visible and metadata collapsed initially", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <LeadTimelinePanel leadId="lead-1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Scan complete")).toBeInTheDocument();
    const disclosure = screen.getByText("Event metadata").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    expect(disclosure).toHaveTextContent('"grade": "B"');
  });
});
