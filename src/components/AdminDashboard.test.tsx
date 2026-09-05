/**
 * Tests for AdminDashboard.tsx — operator admin shell
 *   - AuthGuard wraps content
 *   - Primary navigation links render
 *   - Header shows current operator title
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Hoist mock refs ───────────────────────────────────────────────────────────
const { mockGetSession, mockOnAuthStateChange, mockFunctionsInvoke } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    functions: { invoke: mockFunctionsInvoke },
  },
}));

vi.mock("@/lib/trackConversion", () => ({ trackGtmEvent: vi.fn() }));

// ── Import after mocks ───────────────────────────────────────────────────────
import AdminDashboard from "./AdminDashboard";

function renderDashboard(path = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderDashboardAt(pathname: string, initialTab?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/admin/:tab",
        element: <AdminDashboard initialTab={initialTab} />,
      },
      {
        path: "/admin/command-center",
        element: <AdminDashboard initialTab="mission-control" />,
      },
    ],
    { initialEntries: [pathname] },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();

  // Authenticated session
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "u1" }, access_token: "tok" } },
  });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  // Edge function returns empty arrays
  mockFunctionsInvoke.mockResolvedValue({ data: { data: [] }, error: null });
});

describe("AdminDashboard – operator shell", () => {
  it("renders the Command Center heading and eyebrow", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Command Center" })).toBeInTheDocument();
      expect(screen.getByText("Lead Sniper · Admin")).toBeInTheDocument();
    });
  });

  it("renders local Command Center panel navigation without a second global strip", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Command Center panels" })).toHaveValue(
        "mission-control",
      );
      expect(screen.getByRole("option", { name: "Overview" })).toHaveValue("mission-control");
    });
    expect(screen.queryByRole("link", { name: /^Ghosts\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Dialer\b/i })).not.toBeInTheDocument();
  });

  it("shows settings link to /admin/settings", async () => {
    renderDashboard();
    await waitFor(() => {
      const link = screen.getByTitle("Admin Settings");
      expect(link).toHaveAttribute("href", "/admin/settings");
    });
  });

  it.each([
    ["/", "Command Center · WindowMan Admin"],
    ["/admin/command-center", "Command Center · WindowMan Admin"],
    ["/admin/pipeline", "Pipeline · WindowMan Admin"],
    ["/admin/routing", "Routing · WindowMan Admin"],
    ["/admin/needs-review", "Needs Review · WindowMan Admin"],
  ] as const)("sets a route-aware document title for %s", async (path, expectedTitle) => {
    renderDashboard(path);
    await waitFor(() => {
      expect(document.title).toBe(expectedTitle);
    });
  });

  it("navigates to canonical route when panel selection changes from route-owned tabs", async () => {
    const router = renderDashboardAt("/admin/pipeline", "pipeline");
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Pipeline" })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Command Center panels" }), {
      target: { value: "mission-control" },
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/admin/command-center");
      expect(screen.getByRole("heading", { level: 1, name: "Command Center" })).toBeInTheDocument();
    });
  });
});
