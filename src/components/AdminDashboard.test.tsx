/**
 * Tests for AdminDashboard.tsx — operator admin shell
 *   - AuthGuard wraps content
 *   - Primary navigation links render
 *   - Header shows current operator title
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
});
