import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const {
  navigateSpy,
  invokeAdminDataMock,
  updateLeadDispositionMock,
  quoteViewerClickSpy,
} = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  invokeAdminDataMock: vi.fn(),
  updateLeadDispositionMock: vi.fn(),
  quoteViewerClickSpy: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock("@/services/adminDataService", () => ({
  invokeAdminData: invokeAdminDataMock,
  updateLeadDisposition: updateLeadDispositionMock,
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

vi.mock("@/components/admin/shell/AdminShell", () => ({
  AdminShell: ({
    children,
    belowHeader,
  }: {
    children: ReactNode;
    belowHeader?: ReactNode;
  }) => (
    <div data-testid="admin-shell">
      <header data-testid="shell-header">{belowHeader}</header>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("@/components/admin/shell/AdminGlobalNav", () => ({
  AdminGlobalNav: () => <nav aria-label="Admin navigation" />,
}));

vi.mock("@/components/admin/QuoteViewerButton", () => ({
  QuoteViewerButton: ({
    leadId,
    className,
  }: {
    leadId: string;
    className?: string;
  }) => (
    <button
      type="button"
      className={className}
      onClick={() => quoteViewerClickSpy(leadId)}
    >
      View Quote
    </button>
  ),
}));

import AdminLeadInbox from "@/pages/AdminLeadInbox";

const baseLead = {
  id: "lead-uuid-001",
  session_id: "sess-001",
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",
  phone_e164: "+13055551234",
  county: "Miami-Dade",
  city: "Miami",
  state: "FL",
  zip: "33101",
  grade: "B",
  grade_score: 78,
  window_count: 8,
  quote_amount: 18500,
  phone_verified: true,
  phone_verified_at: "2026-09-03T10:00:00.000Z",
  latest_analysis_id: "analysis-001",
  latest_scan_session_id: "sess-001",
  status: "qualified",
  funnel_stage: "qualified",
  flag_count: 2,
  red_flag_count: 1,
  amber_flag_count: 1,
  critical_flag_count: 0,
  confidence_score: 0.85,
  lead_score: 72,
  scan_count: 1,
  created_at: "2026-09-03T10:00:00.000Z",
  updated_at: "2026-09-03T10:00:00.000Z",
  last_activity_at: "2026-09-03T11:00:00.000Z",
  latest_activity_type: "lead_created",
  admin_disposition: "new",
  admin_priority_override: null,
  admin_follow_up_at: null,
  source: "truth-gate",
  utm_source: "google",
  utm_campaign: "impact-windows-fl",
};

const secondLead = {
  ...baseLead,
  id: "lead-uuid-002",
  session_id: "sess-002",
  first_name: "Alex",
  last_name: "Rivera",
  email: "alex@example.com",
  phone_e164: "+14075551234",
  created_at: "2026-09-02T10:00:00.000Z",
  source: "power-tool-demo",
  funnel_stage: "demo_quote_holder_shortcut",
  qualification_answers_json: {
    intake_status: "Already have a quote to check",
    quote_holder_shortcut: true,
  },
};

function renderInbox() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/leads"]}>
        <AdminLeadInbox />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminLeadInbox", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    quoteViewerClickSpy.mockReset();
    updateLeadDispositionMock.mockReset();
    updateLeadDispositionMock.mockResolvedValue(undefined);
    invokeAdminDataMock.mockReset();
    invokeAdminDataMock.mockResolvedValue([baseLead, secondLead]);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("keeps the operational toolbar out of the sticky shell header", async () => {
    renderInbox();
    await screen.findByRole("list", { name: "Lead results" });
    expect(
      within(screen.getByTestId("shell-header")).queryByRole("textbox", {
        name: "Search leads",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Search leads" }),
    ).toBeInTheDocument();
  });

  it("renders the selected command-rail and directory structure", async () => {
    renderInbox();
    await screen.findByRole("list", { name: "Lead results" });
    expect(
      screen.getByRole("heading", { name: "Lead Inbox", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Lead Inbox controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Lead directory" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh Inbox" }),
    ).toBeInTheDocument();
  });

  it("gives every filter an explicit accessible name", async () => {
    renderInbox();
    await screen.findByRole("list", { name: "Lead results" });
    expect(
      screen.getByRole("textbox", { name: "Search leads" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Date range" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Lead source" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Lead priority" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Lead county" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Phone verification" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Lead stage" }),
    ).toBeInTheDocument();
  });

  it("keeps Clear all disabled until a filter is active and resets search explicitly", async () => {
    renderInbox();
    const search = await screen.findByRole("textbox", { name: "Search leads" });
    const clear = screen.getByRole("button", {
      name: "Clear all filters and search",
    });
    expect(clear).toBeDisabled();
    fireEvent.change(search, { target: { value: "Jane" } });
    expect(clear).toBeEnabled();
    expect(screen.getByText("1 active filter")).toBeInTheDocument();
    fireEvent.click(clear);
    expect(search).toHaveValue("");
    expect(clear).toBeDisabled();
  });

  it("updates the result summary when search narrows the queue", async () => {
    renderInbox();
    const search = await screen.findByRole("textbox", { name: "Search leads" });
    expect(
      await screen.findByText(/2 of 2 leads · priority order/),
    ).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "Jane" } });
    expect(
      await screen.findByText(/1 of 2 leads · priority order/),
    ).toBeInTheDocument();
  });

  it.each([
    ["name", "Jane Doe"],
    ["email", "jane@example.com"],
    ["formatted phone", "(305) 555-1234"],
    ["lead ID", "lead-uuid-001"],
  ])("searches by %s", async (_label, query) => {
    renderInbox();
    const search = await screen.findByRole("textbox", { name: "Search leads" });
    fireEvent.change(search, { target: { value: query } });
    expect(
      screen.getByRole("link", { name: "View details for Jane Doe" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View details for Alex Rivera" }),
    ).not.toBeInTheDocument();
  });

  it("uses real lead links and no mouse-only row navigation", async () => {
    renderInbox();
    const link = await screen.findByRole("link", {
      name: "View details for Jane Doe",
    });
    expect(link).toHaveAttribute("href", "/admin/leads/lead-uuid-001");
    link.focus();
    expect(link).toHaveFocus();
    expect(link.closest("tr")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open Jane Doe in pipeline" }),
    ).toHaveAttribute("href", "/admin/pipeline?lead_id=lead-uuid-001");
    expect(
      screen.getByRole("button", { name: "Copy lead ID lead-uuid-001" }),
    ).toBeInTheDocument();
  });

  it("keeps workflow editors collapsed and opens each lead independently", async () => {
    renderInbox();
    const editButtons = await screen.findAllByRole("button", {
      name: "Edit workflow",
    });
    expect(
      screen.queryByRole("combobox", { name: "Disposition for Jane Doe" }),
    ).not.toBeInTheDocument();
    fireEvent.click(editButtons[0]);
    expect(
      screen.getByRole("combobox", { name: "Disposition for Alex Rivera" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Disposition for Jane Doe" }),
    ).not.toBeInTheDocument();
  });

  it("announces a successful workflow save", async () => {
    renderInbox();
    const janeCard = (
      await screen.findByRole("link", { name: "View details for Jane Doe" })
    ).closest("article");
    expect(janeCard).not.toBeNull();
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Edit workflow" }),
    );
    fireEvent.change(
      within(janeCard!).getByLabelText("Follow-up date and time for Jane Doe"),
      {
        target: { value: "2026-09-05T09:30" },
      },
    );
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Save workflow" }),
    );
    expect(await within(janeCard!).findByRole("status")).toHaveTextContent(
      "Workflow saved",
    );
    expect(updateLeadDispositionMock).toHaveBeenCalledTimes(1);
  });

  it("announces a workflow save failure", async () => {
    updateLeadDispositionMock.mockRejectedValueOnce(new Error("Save failed"));
    renderInbox();
    const janeCard = (
      await screen.findByRole("link", { name: "View details for Jane Doe" })
    ).closest("article");
    expect(janeCard).not.toBeNull();
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Edit workflow" }),
    );
    fireEvent.change(
      within(janeCard!).getByLabelText("Follow-up date and time for Jane Doe"),
      {
        target: { value: "2026-09-05T09:30" },
      },
    );
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Save workflow" }),
    );
    expect(await within(janeCard!).findByRole("alert")).toHaveTextContent(
      "Save failed",
    );
  });

  it("does not route the lead when quote or copy actions are used", async () => {
    renderInbox();
    await screen.findByRole("list", { name: "Lead results" });
    fireEvent.click(screen.getAllByRole("button", { name: "View Quote" })[0]);
    fireEvent.click(
      screen.getByRole("button", { name: "Copy Jane Doe email" }),
    );
    expect(quoteViewerClickSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("preserves priority-then-newest ordering", async () => {
    renderInbox();
    const list = await screen.findByRole("list", { name: "Lead results" });
    const links = within(list).getAllByRole("link", {
      name: /View details for/,
    });
    expect(links.map((link) => link.textContent)).toEqual([
      "Alex Rivera",
      "Jane Doe",
    ]);
  });

  it.each(["ghost", "stale"] as const)(
    "uses an attention tone for %s funnel stage cards",
    async (stage) => {
      invokeAdminDataMock.mockResolvedValueOnce([
        { ...baseLead, funnel_stage: stage, phone_verified: true },
      ]);
      renderInbox();
      const card = (
        await screen.findByRole("link", { name: "View details for Jane Doe" })
      ).closest("article");
      expect(card).not.toBeNull();
      expect(card).toHaveClass("wm-lead-card--attention");
    },
  );

  it("preserves empty and error lifecycle states", async () => {
    invokeAdminDataMock.mockResolvedValueOnce([]);
    const empty = renderInbox();
    expect(await screen.findByText("No leads match")).toBeInTheDocument();
    empty.unmount();

    invokeAdminDataMock.mockRejectedValueOnce(new Error("Inbox unavailable"));
    renderInbox();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Inbox unavailable"),
    );
  });
});
