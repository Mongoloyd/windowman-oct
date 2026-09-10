import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryRouter,
  RouterProvider,
  createMemoryRouter,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_INBOX_FILTERS,
  clearInboxScrollHint,
  inboxFilterSignature,
  parseInboxFilters,
  readInboxScrollHint,
  serializeInboxFilters,
  useAdminLeadInboxState,
  useInboxDirectoryScroll,
  writeInboxScrollHint,
} from "./useAdminLeadInboxState";

function QueryProbe() {
  const [params] = useSearchParams();
  return <div data-testid="query">{params.toString()}</div>;
}

function FilterControls({ counties = ["Miami-Dade"] }: { counties?: string[] }) {
  const state = useAdminLeadInboxState(counties);
  const navigate = useNavigate();
  return (
    <div>
      <QueryProbe />
      <div data-testid="lead">{state.leadId ?? ""}</div>
      <div data-testid="range">{state.filters.range}</div>
      <div data-testid="priority">{state.filters.priority}</div>
      <div data-testid="source">{state.filters.source}</div>
      <div data-testid="shortcut">{state.filters.shortcut}</div>
      <div data-testid="intake">{state.filters.intake}</div>
      <button type="button" onClick={() => state.setRange("7d")}>
        range-7d
      </button>
      <button type="button" onClick={() => state.setPriority("Hot")}>
        priority-hot
      </button>
      <button type="button" onClick={() => state.setVerified("verified")}>
        verified
      </button>
      <button type="button" onClick={() => state.setStage("ghost")}>
        stage-ghost
      </button>
      <button type="button" onClick={() => state.setSource("power-tool-demo")}>
        source-demo
      </button>
      <button type="button" onClick={() => state.setSource("quote-education-demo")}>
        source-quote-education
      </button>
      <button type="button" onClick={() => state.setSource("all")}>
        source-all
      </button>
      <button type="button" onClick={() => state.setShortcut("yes")}>
        shortcut-yes
      </button>
      <button type="button" onClick={() => state.setIntake("Researching")}>
        intake-researching
      </button>
      <button type="button" onClick={() => state.setCounty("Miami-Dade")}>
        county-miami
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        forward
      </button>
    </div>
  );
}

function renderState(path: string, counties?: string[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FilterControls counties={counties} />
    </MemoryRouter>,
  );
}

describe("parse and serialize inbox filters", () => {
  it("parses each recognized filter and omits defaults on serialize", () => {
    const params = new URLSearchParams({
      range: "7d",
      county: "Orange",
      verified: "unverified",
      stage: "ghost",
      source: "power-tool-demo",
      shortcut: "yes",
      priority: "Warm",
      intake: "all",
    });
    const { filters, shouldReplace } = parseInboxFilters(params, ["Orange"]);
    expect(shouldReplace).toBe(false);
    expect(filters).toEqual({
      range: "7d",
      county: "Orange",
      verified: "unverified",
      stage: "ghost",
      source: "power-tool-demo",
      shortcut: "yes",
      priority: "Warm",
      intake: "all",
    });

    const next = serializeInboxFilters(new URLSearchParams("utm_source=google"), filters);
    expect(next.get("range")).toBe("7d");
    expect(next.get("county")).toBe("Orange");
    expect(next.get("verified")).toBe("unverified");
    expect(next.get("stage")).toBe("ghost");
    expect(next.get("source")).toBe("power-tool-demo");
    expect(next.get("shortcut")).toBe("yes");
    expect(next.get("priority")).toBe("Warm");
    expect(next.get("intake")).toBeNull();
    expect(next.get("utm_source")).toBe("google");

    const defaults = serializeInboxFilters(
      new URLSearchParams("utm_source=google&lead_id=abc-123"),
      DEFAULT_INBOX_FILTERS,
    );
    expect(defaults.get("range")).toBeNull();
    expect(defaults.get("county")).toBeNull();
    expect(defaults.get("verified")).toBeNull();
    expect(defaults.get("stage")).toBeNull();
    expect(defaults.get("source")).toBeNull();
    expect(defaults.get("shortcut")).toBeNull();
    expect(defaults.get("priority")).toBeNull();
    expect(defaults.get("intake")).toBeNull();
    expect(defaults.get("utm_source")).toBe("google");
    expect(defaults.get("lead_id")).toBe("abc-123");
  });

  it("reverts invalid recognized values and unknown counties", () => {
    const params = new URLSearchParams(
      "range=nope&verified=maybe&stage=not-a-stage&source=ads&shortcut=quote&priority=Blazing&intake=Unknown&county=Atlantis",
    );
    const { filters, shouldReplace } = parseInboxFilters(params, ["Orange"]);
    expect(shouldReplace).toBe(true);
    expect(filters).toEqual(DEFAULT_INBOX_FILTERS);
  });

  it("excludes search and contact PII keys from serialization", () => {
    const current = new URLSearchParams(
      "email=jane@example.com&phone=305&q=Jane&search=Jane&name=Jane&phone_e164=%2B1&foo=keep",
    );
    const next = serializeInboxFilters(current, { ...DEFAULT_INBOX_FILTERS, range: "24h" });
    expect(next.get("range")).toBe("24h");
    expect(next.get("foo")).toBe("keep");
    expect(next.get("email")).toBeNull();
    expect(next.get("phone")).toBeNull();
    expect(next.get("q")).toBeNull();
    expect(next.get("search")).toBeNull();
    expect(next.get("name")).toBeNull();
    expect(next.get("phone_e164")).toBeNull();
  });

  it.each([
    [
      "Quote Holder",
      { shortcut: "yes", intake: "all" },
    ],
    [
      "Researching",
      { shortcut: "all", intake: "Researching" },
    ],
    [
      "Incomplete",
      { shortcut: "all", intake: "Incomplete" },
    ],
  ] as const)(
    "migrates legacy priority=%s without dropping safe query parameters",
    (legacyPriority, expected) => {
      const params = new URLSearchParams(
        `priority=${encodeURIComponent(legacyPriority)}&lead_id=lead-1&utm_source=google&keep=yes&email=remove@example.com`,
      );
      const { filters, shouldReplace } = parseInboxFilters(params);
      expect(shouldReplace).toBe(true);
      expect(filters.priority).toBe("all");
      expect(filters.source).toBe("power-tool-demo");
      expect(filters.shortcut).toBe(expected.shortcut);
      expect(filters.intake).toBe(expected.intake);

      const canonical = serializeInboxFilters(params, filters);
      expect(canonical.get("priority")).toBeNull();
      expect(canonical.get("source")).toBe("power-tool-demo");
      expect(canonical.get("shortcut")).toBe(
        expected.shortcut === "all" ? null : expected.shortcut,
      );
      expect(canonical.get("intake")).toBe(
        expected.intake === "all" ? null : expected.intake,
      );
      expect(canonical.get("lead_id")).toBe("lead-1");
      expect(canonical.get("utm_source")).toBe("google");
      expect(canonical.get("keep")).toBe("yes");
      expect(canonical.get("email")).toBeNull();
    },
  );

  it("canonicalizes source-specific filters to the demo source", () => {
    const shortcut = parseInboxFilters(new URLSearchParams("shortcut=yes"));
    expect(shortcut.shouldReplace).toBe(true);
    expect(shortcut.filters.source).toBe("power-tool-demo");
    expect(shortcut.filters.shortcut).toBe("yes");

    const intake = parseInboxFilters(
      new URLSearchParams("intake=Researching"),
    );
    expect(intake.shouldReplace).toBe(true);
    expect(intake.filters.source).toBe("power-tool-demo");
    expect(intake.filters.intake).toBe("Researching");
  });

  it("preserves quote education as its own demo source", () => {
    const parsed = parseInboxFilters(new URLSearchParams(
      "source=quote-education-demo&shortcut=yes&intake=Incomplete",
    ));
    expect(parsed.shouldReplace).toBe(false);
    expect(parsed.filters.source).toBe("quote-education-demo");
    expect(parsed.filters.shortcut).toBe("yes");
    expect(parsed.filters.intake).toBe("Incomplete");
  });
});

describe("useAdminLeadInboxState history", () => {
  it("pushes a user filter change and preserves lead_id plus unknown params", async () => {
    renderState("/admin/leads?utm_source=google&lead_id=lead-1");
    fireEvent.click(screen.getByText("range-7d"));
    await waitFor(() => {
      const query = screen.getByTestId("query").textContent ?? "";
      expect(query).toContain("range=7d");
      expect(query).toContain("utm_source=google");
      expect(query).toContain("lead_id=lead-1");
      expect(query).not.toContain("search=");
    });
  });

  it("replaces invalid recognized values back to defaults", async () => {
    renderState("/admin/leads?range=nope&keep=yes");
    await waitFor(() => {
      expect(screen.getByTestId("query").textContent).toContain("keep=yes");
      expect(screen.getByTestId("query").textContent).not.toContain("range=");
    });
  });

  it("replaces an unknown county after loaded counties arrive", async () => {
    renderState("/admin/leads?county=Atlantis", ["Miami-Dade"]);
    await waitFor(() => {
      expect(screen.getByTestId("query").textContent).not.toContain("county=");
    });
  });

  it("clears source-specific filters when leaving the demo source", async () => {
    renderState(
      "/admin/leads?source=power-tool-demo&shortcut=yes&intake=Researching",
    );
    expect(screen.getByTestId("shortcut")).toHaveTextContent("yes");
    expect(screen.getByTestId("intake")).toHaveTextContent("Researching");

    fireEvent.click(screen.getByText("source-all"));
    await waitFor(() => {
      expect(screen.getByTestId("source")).toHaveTextContent("all");
      expect(screen.getByTestId("shortcut")).toHaveTextContent("all");
      expect(screen.getByTestId("intake")).toHaveTextContent("all");
      expect(screen.getByTestId("query")).not.toHaveTextContent("shortcut=");
      expect(screen.getByTestId("query")).not.toHaveTextContent("intake=");
    });
  });

  it("keeps demo-specific filters when switching to quote education", async () => {
    renderState(
      "/admin/leads?source=power-tool-demo&shortcut=yes&intake=Researching",
    );
    fireEvent.click(screen.getByText("source-quote-education"));
    await waitFor(() => {
      expect(screen.getByTestId("source")).toHaveTextContent("quote-education-demo");
      expect(screen.getByTestId("shortcut")).toHaveTextContent("yes");
      expect(screen.getByTestId("intake")).toHaveTextContent("Researching");
    });
  });

  it("restores filters on Back and Forward after pushed changes", async () => {
    const router = createMemoryRouter(
      [{ path: "/admin/leads", element: <FilterControls /> }],
      { initialEntries: ["/other", "/admin/leads"], initialIndex: 1 },
    );
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByText("range-7d"));
    await waitFor(() => expect(screen.getByTestId("range").textContent).toBe("7d"));
    fireEvent.click(screen.getByText("priority-hot"));
    await waitFor(() => expect(screen.getByTestId("priority").textContent).toBe("Hot"));

    fireEvent.click(screen.getByText("back"));
    await waitFor(() => {
      expect(screen.getByTestId("range").textContent).toBe("7d");
      expect(screen.getByTestId("priority").textContent).toBe("all");
    });

    fireEvent.click(screen.getByText("forward"));
    await waitFor(() => {
      expect(screen.getByTestId("range").textContent).toBe("7d");
      expect(screen.getByTestId("priority").textContent).toBe("Hot");
    });
  });

  it("uses replace for invalid values so Back does not revive them", async () => {
    const router = createMemoryRouter(
      [{ path: "*", element: <FilterControls /> }],
      {
        initialEntries: ["/other", "/admin/leads?range=nope&keep=yes"],
        initialIndex: 1,
      },
    );
    render(<RouterProvider router={router} />);
    await waitFor(() => {
      expect(screen.getByTestId("query").textContent).toContain("keep=yes");
      expect(screen.getByTestId("query").textContent).not.toContain("range=");
    });

    fireEvent.click(screen.getByText("range-7d"));
    await waitFor(() => expect(screen.getByTestId("range").textContent).toBe("7d"));

    fireEvent.click(screen.getByText("back"));
    await waitFor(() => {
      expect(screen.getByTestId("range").textContent).toBe("all");
      expect(screen.getByTestId("query").textContent).toContain("keep=yes");
    });

    fireEvent.click(screen.getByText("back"));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/other");
    });
  });
});

describe("inbox scroll hints", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("captures and restores a matching non-PII scroll hint", () => {
    const filters = { ...DEFAULT_INBOX_FILTERS, range: "7d" as const };
    writeInboxScrollHint(filters, 240);
    expect(readInboxScrollHint(filters)?.offset).toBe(240);
    expect(inboxFilterSignature(filters)).toBe(
      "range=7d&county=all&verified=all&stage=all&source=all&shortcut=all&priority=all&intake=all",
    );
    expect(inboxFilterSignature(filters)).not.toMatch(/Jane|@|305/);
    expect(sessionStorage.getItem(Object.keys(sessionStorage)[0] ?? "") ?? "").not.toMatch(
      /Jane|@example|305555/,
    );
  });

  it("clears stale or impossible scroll hints", () => {
    const filters = DEFAULT_INBOX_FILTERS;
    const key = `wm-admin-inbox-scroll:/admin/leads?${inboxFilterSignature(filters)}`;
    sessionStorage.setItem(
      key,
      JSON.stringify({
        offset: 80,
        signature: inboxFilterSignature(filters),
        savedAt: Date.now() - 40 * 60 * 1000,
      }),
    );
    expect(readInboxScrollHint(filters)).toBeNull();

    writeInboxScrollHint(filters, 80);
    clearInboxScrollHint(filters);
    expect(readInboxScrollHint(filters)).toBeNull();
  });

  it("restores after rows become ready and ignores a mismatched signature", async () => {
    const restoreScroll = vi.fn(() => true);
    const resetScroll = vi.fn();

    function ReadyHarness({ ready }: { ready: boolean }) {
      useInboxDirectoryScroll({
        filters: DEFAULT_INBOX_FILTERS,
        search: "",
        isReady: ready,
        captureScroll: () => undefined,
        restoreScroll,
        resetScroll,
      });
      return <div>ready:{String(ready)}</div>;
    }

    const view = render(<ReadyHarness ready={false} />);
    expect(restoreScroll).not.toHaveBeenCalled();
    view.rerender(<ReadyHarness ready={true} />);
    await waitFor(() => expect(restoreScroll).toHaveBeenCalled());

    const other = { ...DEFAULT_INBOX_FILTERS, range: "7d" as const };
    writeInboxScrollHint(DEFAULT_INBOX_FILTERS, 120);
    expect(readInboxScrollHint(other)).toBeNull();
    expect(readInboxScrollHint(DEFAULT_INBOX_FILTERS)?.offset).toBe(120);
  });

  it("resets scroll when local search changes", () => {
    const resetScroll = vi.fn();

    function SearchHarness({ search }: { search: string }) {
      useInboxDirectoryScroll({
        filters: DEFAULT_INBOX_FILTERS,
        search,
        isReady: true,
        captureScroll: () => undefined,
        restoreScroll: () => false,
        resetScroll,
      });
      return null;
    }

    const view = render(<SearchHarness search="" />);
    view.rerender(<SearchHarness search="Jane" />);
    expect(resetScroll).toHaveBeenCalled();
  });

  it("resets to top when no matching scroll hint can be restored", () => {
    vi.useFakeTimers();
    const resetScroll = vi.fn();
    const restoreScroll = vi.fn(() => false);

    function RestoreFallbackHarness() {
      useInboxDirectoryScroll({
        filters: DEFAULT_INBOX_FILTERS,
        search: "",
        isReady: true,
        captureScroll: () => undefined,
        restoreScroll,
        resetScroll,
      });
      return null;
    }

    render(<RestoreFallbackHarness />);
    vi.advanceTimersByTime(1_000);
    expect(restoreScroll).toHaveBeenCalled();
    expect(resetScroll).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
