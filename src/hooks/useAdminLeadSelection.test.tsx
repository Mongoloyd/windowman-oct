import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryRouter,
  useSearchParams,
} from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_XL_MEDIA_QUERY,
  buildLeadSelectionHref,
  captureCollectionScroll,
  restoreCollectionScroll,
  useAdminLeadSelection,
  useAdminXlPresentation,
  writeLeadIdParam,
} from "./useAdminLeadSelection";

const leads = [{ id: "0621be04-8984-4087-8cec-324e0efd25d4" }, { id: "1721be04-8984-4087-8cec-324e0efd25d4" }];

function SelectionHarness() {
  const [params] = useSearchParams();
  const state = useAdminLeadSelection(leads, { isReady: true });
  return (
    <div>
      <div data-testid="query">{params.toString()}</div>
      <div data-testid="selected">{state.selectedLeadId ?? ""}</div>
      <div data-testid="inaccessible">{String(state.inaccessible)}</div>
      <div data-testid="presentation">{state.presentation}</div>
      <a href={state.openHref(leads[0].id)} data-testid="open-href">
        href
      </a>
      <button type="button" onClick={(event) => state.openLead(leads[0].id, event.currentTarget)}>
        open-first
      </button>
      <button type="button" onClick={() => state.closeLead()}>
        close
      </button>
      <a href={state.expandHref(leads[0].id)}>Open Lead Workspace</a>
    </div>
  );
}

function renderSelection(initialEntries: string[]) {
  const router = createMemoryRouter(
    [{ path: "*", element: <SelectionHarness /> }],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );
  const view = render(<RouterProvider router={router} />);
  return { router, ...view };
}

describe("lead_id URL helpers", () => {
  it("pushes lead_id while preserving unknown params and omitting PII", () => {
    const current = new URLSearchParams("range=7d&utm_source=google&email=jane@example.com");
    const next = writeLeadIdParam(current, "0621be04-8984-4087-8cec-324e0efd25d4");
    expect(next.get("lead_id")).toBe("0621be04-8984-4087-8cec-324e0efd25d4");
    expect(next.get("range")).toBe("7d");
    expect(next.get("utm_source")).toBe("google");
    expect(next.get("email")).toBeNull();
    expect(buildLeadSelectionHref(current, "0621be04-8984-4087-8cec-324e0efd25d4")).toContain(
      "lead_id=0621be04-8984-4087-8cec-324e0efd25d4",
    );
  });

  it("removes only lead_id on close serialization", () => {
    const current = new URLSearchParams(
      "range=7d&utm_source=google&lead_id=0621be04-8984-4087-8cec-324e0efd25d4",
    );
    const next = writeLeadIdParam(current, null);
    expect(next.get("lead_id")).toBeNull();
    expect(next.get("range")).toBe("7d");
    expect(next.get("utm_source")).toBe("google");
  });
});

describe("useAdminLeadSelection history", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("pushes one history entry on list open and uses Back to close", async () => {
    const { router } = renderSelection(["/admin/leads?range=7d&utm_source=google"]);
    fireEvent.click(screen.getByText("open-first"));
    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).toBe(leads[0].id);
      expect(screen.getByTestId("query").textContent).toContain("range=7d");
      expect(screen.getByTestId("query").textContent).toContain("utm_source=google");
    });
    expect(router.state.historyAction).toBe("PUSH");

    fireEvent.click(screen.getByText("close"));
    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).toBe("");
      expect(screen.getByTestId("query").textContent).toContain("range=7d");
      expect(screen.getByTestId("query").textContent).not.toContain("lead_id=");
    });
  });

  it("replaces only lead_id when closing a direct query selection", async () => {
    renderSelection([
      "/other",
      "/admin/leads?range=7d&utm_source=google&lead_id=0621be04-8984-4087-8cec-324e0efd25d4",
    ]);
    expect(screen.getByTestId("selected").textContent).toBe(leads[0].id);
    fireEvent.click(screen.getByText("close"));
    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).toBe("");
      expect(screen.getByTestId("query").textContent).toContain("range=7d");
      expect(screen.getByTestId("query").textContent).toContain("utm_source=google");
      expect(screen.getByTestId("query").textContent).not.toContain("lead_id=");
    });
    fireEvent.click(screen.getByText("close"));
    expect(screen.getByTestId("query").textContent).not.toContain("lead_id=");
  });

  it("marks an unknown selected lead as inaccessible", () => {
    renderSelection(["/admin/leads?lead_id=99999999-9999-4999-8999-999999999999"]);
    expect(screen.getByTestId("inaccessible").textContent).toBe("true");
  });

  it("uses a full-viewport presentation below xl and a sheet at xl", async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query === ADMIN_XL_MEDIA_QUERY,
        media: query,
        addEventListener,
        removeEventListener,
        addListener: addEventListener,
        removeListener: removeEventListener,
      }),
    });

    function PresentationProbe() {
      return <div data-testid="mode">{useAdminXlPresentation()}</div>;
    }

    const view = render(<PresentationProbe />);
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("sheet"));
    view.unmount();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener,
        removeEventListener,
        addListener: addEventListener,
        removeListener: removeEventListener,
      }),
    });
    render(<PresentationProbe />);
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("full-viewport"));
  });

  it("restores a matching collection scroll hint", () => {
    captureCollectionScroll("/admin/leads", new URLSearchParams("range=7d"));
    const stored = sessionStorage.getItem("wm-admin-collection-scroll:/admin/leads?range=7d");
    expect(stored).toContain('"offset"');
    expect(stored).not.toMatch(/Jane|@example|305555/);
    expect(restoreCollectionScroll("/admin/pipeline", new URLSearchParams("range=7d"))).toBe(false);
  });
});
