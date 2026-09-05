import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
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
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate();
      return (to: Parameters<typeof navigate>[0], options?: Parameters<typeof navigate>[1]) => {
        navigateSpy(to, options);
        return navigate(to, options);
      };
    },
  };
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
    title,
    belowHeader,
  }: {
    children: ReactNode;
    title?: string;
    belowHeader?: ReactNode;
  }) => (
    <div data-testid="admin-shell">
      <header data-testid="shell-header">
        {title ? <h1>{title}</h1> : null}
        {belowHeader}
      </header>
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("@/components/admin/shell/AdminGlobalNav", () => ({
  AdminGlobalNav: () => <nav aria-label="Admin navigation" />,
}));

vi.mock("@/components/admin/LeadDossierSheet", () => ({
  LeadDossierSheet: ({
    lead,
    open,
    presentation,
    onOpenChange,
  }: {
    lead: { id: string } | null;
    open: boolean;
    presentation?: string;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div
        role="dialog"
        data-testid="admin-lead-quick-view"
        data-presentation={presentation}
        aria-label={lead ? `Lead detail ${lead.id}` : "Lead unavailable"}
      >
        <h2>{lead ? lead.id : "Lead unavailable"}</h2>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close lead detail
        </button>
        {lead ? <a href={`/admin/leads/${lead.id}`}>Expand</a> : null}
      </div>
    ) : null,
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

const demoHotLead = {
  ...baseLead,
  id: "lead-demo-hot",
  session_id: "sess-demo-hot",
  first_name: "Harper",
  last_name: "Hot",
  source: "power-tool-demo",
  funnel_stage: "demo_intake_complete",
  created_at: "2026-09-01T10:00:00.000Z",
  qualification_answers_json: {
    intake_status: "Need help reviewing options",
    intake_property: "Single-family home",
    intake_scope: "6 to 10 Openings",
    intake_logistics: "Owner occupied",
    intake_timeline: "Immediate - 30 Days",
    quote_holder_shortcut: false,
  },
};

const demoWarmLead = {
  ...demoHotLead,
  id: "lead-demo-warm",
  session_id: "sess-demo-warm",
  first_name: "Wendy",
  last_name: "Warm",
  created_at: "2026-09-02T10:00:00.000Z",
  qualification_answers_json: {
    ...demoHotLead.qualification_answers_json,
    intake_scope: "1 to 5 Openings",
    intake_timeline: "4-6 Months",
  },
};

const demoResearchingLead = {
  ...demoWarmLead,
  id: "lead-demo-researching",
  session_id: "sess-demo-researching",
  first_name: "Riley",
  last_name: "Researching",
  funnel_stage: "new",
  qualification_answers_json: {
    ...demoWarmLead.qualification_answers_json,
    intake_status: "Just researching options",
  },
};

const demoIncompleteLead = {
  ...demoWarmLead,
  id: "lead-demo-incomplete",
  session_id: "sess-demo-incomplete",
  first_name: "Ivy",
  last_name: "Incomplete",
  funnel_stage: "new",
  qualification_answers_json: {
    intake_status: "Need help reviewing options",
    quote_holder_shortcut: false,
  },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderInbox(
  path = "/admin/leads",
  queryClient = createTestQueryClient(),
) {
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AdminLeadInbox />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

async function chooseSelectOption(trigger: HTMLElement, optionName: string) {
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
  const option = await screen.findByRole("option", { name: optionName });
  fireEvent.click(option);
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
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: () => false,
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: () => undefined,
    });
  });

  it("keeps exactly one Inbox search input in local component state", async () => {
    renderInbox();
    await screen.findByRole("list", { name: "Lead results" });
    const searches = screen.getAllByRole("textbox", { name: "Search leads" });
    expect(searches).toHaveLength(1);
    expect(
      screen.queryByRole("textbox", { name: "Search leads from command bar" }),
    ).not.toBeInTheDocument();
    fireEvent.change(searches[0], { target: { value: "Jane" } });
    expect(
      screen.getByRole("link", { name: "View details for Jane Doe" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View details for Alex Rivera" }),
    ).not.toBeInTheDocument();
  });

  it("labels Jane Doe's Open lead control as View lead, not workspace", async () => {
    renderInbox();
    const janeCard = (
      await screen.findByRole("link", { name: "View details for Jane Doe" })
    ).closest("article");
    expect(janeCard).not.toBeNull();
    expect(within(janeCard!).getByRole("link", { name: "View lead for Jane Doe" })).toBeInTheDocument();
    expect(
      within(janeCard!).queryByRole("link", { name: "Open lead workspace for Jane Doe" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View details for Jane Doe" })).toBeInTheDocument();
  });

  it("renders the selected command-rail and directory structure", async () => {
    renderInbox();
    await screen.findByRole("list", { name: "Lead results" });
    expect(screen.getAllByRole("heading", { name: "Lead Inbox", level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("complementary", { name: "Lead Inbox controls" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Lead directory" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh Inbox" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".wm-lead-inbox__layout")).not.toBeNull();
    expect(document.querySelector(".wm-lead-card__identity-and-actions")).not.toBeNull();
    expect(document.querySelector(".wm-lead-card__facts")).not.toBeNull();
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
      screen.getByRole("combobox", { name: "Lead lifecycle stage" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Intake signal" }),
    ).not.toBeInTheDocument();
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
    expect(
      within(screen.getByRole("region", { name: "Lead directory" })).getByText(
        "1 active filter",
      ),
    ).toBeInTheDocument();
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
    const card = link.closest("article");
    expect(card).not.toBeNull();
    expect(link.getAttribute("href")).toContain("lead_id=lead-uuid-001");
    link.focus();
    expect(link).toHaveFocus();
    expect(link.closest("tr")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open Jane Doe in pipeline" }),
    ).toHaveAttribute("href", "/admin/pipeline?lead_id=lead-uuid-001");
    expect(
      screen.getByRole("button", { name: "Copy lead ID lead-uuid-001" }),
    ).toBeInTheDocument();
    expect(
      within(card!).getByLabelText("Qualified: stage 2 of 5"),
    ).toBeInTheDocument();
  });

  it("keeps workflow editors collapsed and opens each lead independently", async () => {
    renderInbox();
    const editButtons = await screen.findAllByRole("button", {
      name: "Edit workflow",
    });
    expect(
      screen.queryByRole("combobox", {
        name: "Follow-up disposition for Jane Doe",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(editButtons[0]);
    expect(
      screen.getByRole("combobox", {
        name: "Follow-up disposition for Alex Rivera",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", {
        name: "Follow-up disposition for Jane Doe",
      }),
    ).not.toBeInTheDocument();
  });

  it("submits exact workflow values and announces success only after confirmed refetch", async () => {
    const followUp = "2026-09-05T09:30";
    const followUpIso = new Date(followUp).toISOString();
    const persistedLead = {
      ...baseLead,
      admin_disposition: "follow_up",
      admin_priority_override: "hot",
      admin_follow_up_at: followUpIso,
    };
    invokeAdminDataMock
      .mockResolvedValueOnce([baseLead, secondLead])
      .mockResolvedValueOnce([persistedLead, secondLead]);

    let resolveMutation!: () => void;
    const mutation = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    updateLeadDispositionMock.mockReturnValueOnce(mutation);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const refetchSpy = vi.spyOn(queryClient, "refetchQueries");
    renderInbox("/admin/leads", queryClient);
    const janeCard = (
      await screen.findByRole("link", { name: "View details for Jane Doe" })
    ).closest("article");
    expect(janeCard).not.toBeNull();
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Edit workflow" }),
    );
    await chooseSelectOption(
      within(janeCard!).getByRole("combobox", {
        name: "Follow-up disposition for Jane Doe",
      }),
      "Follow up",
    );
    await chooseSelectOption(
      within(janeCard!).getByRole("combobox", {
        name: "Priority override for Jane Doe",
      }),
      "Hot",
    );
    fireEvent.change(
      within(janeCard!).getByLabelText("Follow-up date and time for Jane Doe"),
      {
        target: { value: followUp },
      },
    );
    const saveButton = within(janeCard!).getByRole("button", {
      name: "Save workflow",
    });
    fireEvent.click(saveButton);

    expect(updateLeadDispositionMock).toHaveBeenCalledWith({
      lead_id: baseLead.id,
      admin_disposition: "follow_up",
      admin_priority_override: "hot",
      admin_follow_up_at: followUpIso,
    });
    expect(saveButton).toBeDisabled();
    expect(within(janeCard!).queryByRole("status")).not.toBeInTheDocument();

    await act(async () => {
      resolveMutation();
      await mutation;
    });

    expect(await within(janeCard!).findByRole("status")).toHaveTextContent(
      "Workflow saved",
    );
    expect(updateLeadDispositionMock).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "leads"],
      exact: true,
      refetchType: "none",
    });
    expect(refetchSpy).toHaveBeenCalledWith(
      {
        queryKey: ["admin", "leads"],
        exact: true,
        type: "active",
      },
      { throwOnError: true },
    );

    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Edit workflow" }),
    );
    expect(
      within(janeCard!).queryByRole("combobox", {
        name: "Priority override for Jane Doe",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Edit workflow" }),
    );
    expect(
      within(janeCard!).getByRole("combobox", {
        name: "Priority override for Jane Doe",
      }),
    ).toHaveTextContent("Hot");
  });

  it("keeps workflow values dirty and recoverable when refreshed data does not match", async () => {
    const followUp = "2026-09-05T09:30";
    renderInbox();
    const janeCard = (
      await screen.findByRole("link", { name: "View details for Jane Doe" })
    ).closest("article");
    expect(janeCard).not.toBeNull();
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Edit workflow" }),
    );
    const followUpInput = within(janeCard!).getByLabelText(
      "Follow-up date and time for Jane Doe",
    );
    fireEvent.change(followUpInput, { target: { value: followUp } });
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Save workflow" }),
    );

    expect(await within(janeCard!).findByRole("alert")).toHaveTextContent(
      "The server response could not be confirmed. Your changes may not have persisted; refresh and try again.",
    );
    expect(followUpInput).toHaveValue(followUp);
    expect(
      within(janeCard!).getByRole("button", { name: "Save workflow" }),
    ).toBeEnabled();
    expect(within(janeCard!).queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not claim success when the confirmation refetch fails", async () => {
    invokeAdminDataMock
      .mockResolvedValueOnce([baseLead, secondLead])
      .mockRejectedValueOnce(new Error("Refresh failed"));
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
      { target: { value: "2026-09-05T09:30" } },
    );
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Save workflow" }),
    );

    expect(await within(janeCard!).findByRole("alert")).toHaveTextContent(
      "The server response could not be confirmed",
    );
    expect(within(janeCard!).queryByRole("status")).not.toBeInTheDocument();
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

  it.each([
    ["Hot", "hot", "Holly Hot"],
    ["Warm", "warm", "Willow Warm"],
  ] as const)(
    "matches a non-demo manual %s override in the Priority filter",
    async (filter, override, expectedName) => {
      invokeAdminDataMock.mockResolvedValueOnce([
        {
          ...baseLead,
          id: `lead-${override}`,
          first_name: expectedName.split(" ")[0],
          last_name: expectedName.split(" ")[1],
          admin_priority_override: override,
        },
        {
          ...baseLead,
          id: "lead-other",
          first_name: "Other",
          last_name: "Lead",
          admin_priority_override: override === "hot" ? "warm" : "hot",
        },
      ]);
      renderInbox(`/admin/leads?priority=${filter}`);
      expect(
        await screen.findByRole("link", {
          name: `View details for ${expectedName}`,
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "View details for Other Lead" }),
      ).not.toBeInTheDocument();
    },
  );

  it("lets a manual Warm override win over a derived Hot signal", async () => {
    const manualWarmDerivedHot = {
      ...demoHotLead,
      admin_priority_override: "warm",
    };
    invokeAdminDataMock.mockResolvedValueOnce([manualWarmDerivedHot]);
    const hotView = renderInbox("/admin/leads?priority=Hot");
    expect(await screen.findByText("No leads match")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View details for Harper Hot" }),
    ).not.toBeInTheDocument();
    hotView.unmount();

    invokeAdminDataMock.mockResolvedValueOnce([manualWarmDerivedHot]);
    renderInbox("/admin/leads?priority=Warm");
    expect(
      await screen.findByRole("link", { name: "View details for Harper Hot" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["Hot", demoHotLead, "Harper Hot"],
    ["Warm", demoWarmLead, "Wendy Warm"],
  ] as const)(
    "retains derived %s urgency when no manual override exists",
    async (filter, lead, expectedName) => {
      invokeAdminDataMock.mockResolvedValueOnce([lead]);
      renderInbox(`/admin/leads?priority=${filter}`);
      expect(
        await screen.findByRole("link", {
          name: `View details for ${expectedName}`,
        }),
      ).toBeInTheDocument();
    },
  );

  it("uses effective urgency consistently for the Hot KPI", async () => {
    invokeAdminDataMock.mockResolvedValueOnce([
      { ...baseLead, admin_priority_override: "hot" },
      demoHotLead,
      { ...demoHotLead, id: "lead-warm-override", admin_priority_override: "warm" },
      { ...baseLead, id: "lead-cold", admin_priority_override: "cold" },
    ]);
    renderInbox();
    await screen.findByRole("list", { name: "Lead results" });
    const summary = await screen.findByRole("region", {
      name: "Lead queue summary",
    });
    const hotLabel = within(summary).getByText("Hot leads");
    expect(hotLabel.parentElement).not.toBeNull();
    expect(within(hotLabel.parentElement!).getByText("2")).toBeInTheDocument();
  });

  it("uses effective urgency for the demo-source Hot subtitle", async () => {
    invokeAdminDataMock.mockResolvedValueOnce([
      demoHotLead,
      {
        ...demoHotLead,
        id: "lead-demo-manual-warm",
        first_name: "Manual",
        last_name: "Warm Demo",
        admin_priority_override: "warm",
      },
    ]);
    renderInbox("/admin/leads?source=power-tool-demo");
    expect(
      await screen.findByText(/2 of 2 leads · 1 hot · priority order/),
    ).toBeInTheDocument();
  });

  it("ranks manual overrides first for their lead and keeps newest-first ties", async () => {
    invokeAdminDataMock.mockResolvedValueOnce([
      {
        ...demoHotLead,
        id: "lead-derived-hot-manual-warm",
        first_name: "Derived",
        last_name: "Warm Override",
        admin_priority_override: "warm",
        created_at: "2026-09-05T10:00:00.000Z",
      },
      {
        ...baseLead,
        id: "lead-manual-hot-old",
        first_name: "Manual",
        last_name: "Hot Old",
        admin_priority_override: "hot",
        created_at: "2026-09-03T10:00:00.000Z",
      },
      {
        ...baseLead,
        id: "lead-manual-hot-new",
        first_name: "Manual",
        last_name: "Hot New",
        admin_priority_override: "hot",
        created_at: "2026-09-04T10:00:00.000Z",
      },
      {
        ...secondLead,
        id: "lead-quote-holder",
        first_name: "Quinn",
        last_name: "Quote Holder",
      },
      {
        ...baseLead,
        id: "lead-legacy-cold",
        first_name: "Legacy",
        last_name: "Cold",
        admin_priority_override: "cold",
        created_at: "2026-09-06T10:00:00.000Z",
      },
    ]);
    renderInbox();
    const list = await screen.findByRole("list", { name: "Lead results" });
    expect(
      within(list)
        .getAllByRole("link", { name: /View details for/ })
        .map((link) => link.textContent),
    ).toEqual([
      "Quinn Quote Holder",
      "Manual Hot New",
      "Manual Hot Old",
      "Derived Warm Override",
      "Legacy Cold",
    ]);
  });

  it("shows only All, Hot, and Warm in the visible Priority menu", async () => {
    renderInbox();
    const trigger = await screen.findByRole("combobox", {
      name: "Lead priority",
    });
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent),
    ).toEqual(["All priorities", "Hot", "Warm"]);
    expect(screen.queryByRole("option", { name: "Quote Holder" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Researching" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Incomplete" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Cold" })).toBeNull();
  });

  it("shows Researching and Incomplete in the demo-only Intake signal filter", async () => {
    invokeAdminDataMock.mockResolvedValueOnce([
      demoResearchingLead,
      demoIncompleteLead,
    ]);
    renderInbox("/admin/leads?source=power-tool-demo&intake=Researching");
    const trigger = await screen.findByRole("combobox", {
      name: "Intake signal",
    });
    expect(
      await screen.findByRole("link", {
        name: "View details for Riley Researching",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View details for Ivy Incomplete" }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent),
    ).toEqual(["All intake signals", "Researching", "Incomplete"]);
  });

  it("matches every existing Quote Holder condition in Quote Status", async () => {
    const shortcutLead = {
      ...demoWarmLead,
      id: "quote-shortcut",
      first_name: "Shortcut",
      last_name: "Match",
      qualification_answers_json: {
        ...demoWarmLead.qualification_answers_json,
        quote_holder_shortcut: true,
      },
    };
    const stageLead = {
      ...demoWarmLead,
      id: "quote-stage",
      first_name: "Stage",
      last_name: "Match",
      funnel_stage: "demo_quote_holder_shortcut",
    };
    const statusLead = {
      ...demoWarmLead,
      id: "quote-status",
      first_name: "Status",
      last_name: "Match",
      qualification_answers_json: {
        ...demoWarmLead.qualification_answers_json,
        intake_status: "Already have a quote to check",
      },
    };
    const noQuoteLead = {
      ...demoWarmLead,
      id: "no-quote",
      first_name: "No",
      last_name: "Quote",
    };
    invokeAdminDataMock.mockResolvedValueOnce([
      shortcutLead,
      stageLead,
      statusLead,
      noQuoteLead,
    ]);
    renderInbox("/admin/leads?source=power-tool-demo&shortcut=yes");
    await screen.findByRole("list", { name: "Lead results" });
    for (const name of ["Shortcut Match", "Stage Match", "Status Match"]) {
      expect(
        screen.getByRole("link", { name: `View details for ${name}` }),
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("link", { name: "View details for No Quote" }),
    ).not.toBeInTheDocument();
  });

  it("treats No quote as the inverse of the complete Quote Holder predicate", async () => {
    const statusLead = {
      ...demoWarmLead,
      id: "quote-status",
      first_name: "Status",
      last_name: "Match",
      qualification_answers_json: {
        ...demoWarmLead.qualification_answers_json,
        intake_status: "Already have a quote to check",
      },
    };
    const noQuoteLead = {
      ...demoWarmLead,
      id: "no-quote",
      first_name: "No",
      last_name: "Quote",
    };
    invokeAdminDataMock.mockResolvedValueOnce([statusLead, noQuoteLead]);
    renderInbox("/admin/leads?source=power-tool-demo&shortcut=no");
    expect(
      await screen.findByRole("link", { name: "View details for No Quote" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View details for Status Match" }),
    ).not.toBeInTheDocument();
  });

  it("offers only canonical lifecycle stages for a normal selection", async () => {
    renderInbox();
    const trigger = await screen.findByRole("combobox", {
      name: "Lead lifecycle stage",
    });
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    await screen.findByRole("option", { name: "All stages" });
    expect(
      screen.queryByRole("option", { name: /Demo intake complete/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("option", { name: /Demo quote shortcut/ }),
    ).toBeNull();
  });

  it("keeps demo stages URL-readable without offering them as new lifecycle choices", async () => {
    invokeAdminDataMock.mockResolvedValueOnce([secondLead]);
    renderInbox(
      "/admin/leads?source=power-tool-demo&stage=demo_quote_holder_shortcut",
    );
    const trigger = await screen.findByRole("combobox", {
      name: "Lead lifecycle stage",
    });
    expect(trigger).toHaveTextContent("Demo quote shortcut");
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    const legacy = await screen.findByRole("option", {
      name: "Demo quote shortcut — legacy",
    });
    expect(legacy).toHaveAttribute("data-disabled");
    expect(
      screen.queryByRole("option", { name: "Demo intake complete" }),
    ).toBeNull();
  });

  it("does not offer Cold for new overrides but keeps persisted Cold readable", async () => {
    invokeAdminDataMock.mockResolvedValueOnce([
      { ...baseLead, admin_priority_override: "cold" },
    ]);
    renderInbox();
    const janeCard = (
      await screen.findByRole("link", { name: "View details for Jane Doe" })
    ).closest("article");
    expect(janeCard).not.toBeNull();
    fireEvent.click(
      within(janeCard!).getByRole("button", { name: "Edit workflow" }),
    );
    const trigger = within(janeCard!).getByRole("combobox", {
      name: "Priority override for Jane Doe",
    });
    expect(trigger).toHaveTextContent("Cold");
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    const legacy = await screen.findByRole("option", {
      name: "Cold — legacy",
    });
    expect(legacy).toHaveAttribute("data-disabled");
    fireEvent.click(screen.getByRole("option", { name: "Hot" }));
    expect(trigger).toHaveTextContent("Hot");
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

  it("opens a list-launched lead on the current collection URL and keeps the list mounted", async () => {
    renderInbox("/admin/leads?range=7d&utm_source=google");
    fireEvent.click(
      await screen.findByRole("link", { name: "View details for Jane Doe" }),
    );
    const detail = await screen.findByTestId("admin-lead-quick-view");
    expect(detail).toHaveTextContent("lead-uuid-001");
    expect(screen.getByRole("list", { name: "Lead results" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Expand" })).toHaveAttribute(
      "href",
      "/admin/leads/lead-uuid-001",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close lead detail" }));
    await waitFor(() => {
      expect(screen.queryByTestId("admin-lead-quick-view")).not.toBeInTheDocument();
    });
    expect(navigateSpy).toHaveBeenCalledWith(-1, undefined);
    expect(screen.getByRole("list", { name: "Lead results" })).toBeInTheDocument();
  });

  it("closes a direct query lead without pushing a closed history entry", async () => {
    renderInbox("/admin/leads?range=7d&lead_id=lead-uuid-001");
    expect(await screen.findByTestId("admin-lead-quick-view")).toHaveTextContent(
      "lead-uuid-001",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close lead detail" }));
    await waitFor(() => {
      expect(screen.queryByTestId("admin-lead-quick-view")).not.toBeInTheDocument();
    });
    expect(navigateSpy).not.toHaveBeenCalledWith(-1, undefined);
    expect(screen.getByRole("list", { name: "Lead results" })).toBeInTheDocument();
  });

  it("recovers from an inaccessible selected lead", async () => {
    renderInbox("/admin/leads?lead_id=missing-lead");
    expect(await screen.findByTestId("admin-lead-quick-view")).toHaveTextContent(
      "Lead unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close lead detail" }));
    await waitFor(() => {
      expect(screen.queryByTestId("admin-lead-quick-view")).not.toBeInTheDocument();
    });
  });

  it("preserves directory geometry while leads load", async () => {
    invokeAdminDataMock.mockImplementation(() => new Promise(() => undefined));
    renderInbox();
    expect(
      await screen.findByRole("list", { name: "Loading leads" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".wm-lead-inbox__layout")).not.toBeNull();
    expect(document.querySelector(".wm-lead-card__facts")).not.toBeNull();
    expect(
      screen.getByRole("complementary", { name: "Lead Inbox controls" }),
    ).toBeInTheDocument();
  });

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
