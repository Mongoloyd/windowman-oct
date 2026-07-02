/**
 * Tests for AuthGuard.tsx
 * Covers: loading state, unauthenticated state, authenticated (children) state,
 *         auth state change subscription lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthGuard } from "./AuthGuard";

// ── Mock the supabase client ──────────────────────────────────────────────────
// vi.mock is hoisted, so factory variables must be declared with vi.hoisted().
const { mockGetSession, mockOnAuthStateChange, mockUnsubscribe } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

// Helper: build a minimal fake session user
function fakeSession(userId = "user-123") {
  return { user: { id: userId, email: "test@example.com" } };
}

function renderGuard(children: ReactNode) {
  return render(<MemoryRouter>{children}</MemoryRouter>);
}

beforeEach(() => {
  vi.stubEnv("VITE_AUTH_GUARD_DEV_BYPASS", "");
  vi.clearAllMocks();
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── Loading state ─────────────────────────────────────────────────────────────
describe("AuthGuard – loading state", () => {
  it("renders the loading spinner while session check is in progress", () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));

    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Checking authentication...")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("does not show sign-in message while still checking", () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));

    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    expect(screen.queryByText("Sign in required")).not.toBeInTheDocument();
  });
});

// ── Unauthenticated state ─────────────────────────────────────────────────────
describe("AuthGuard – unauthenticated", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
  });

  it("shows 'Sign in required' when session is null", async () => {
    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign in required")).toBeInTheDocument();
    });
  });

  it("shows the descriptive message to the user", async () => {
    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(
        screen.getByText("You must be signed in to access this page.")
      ).toBeInTheDocument();
    });
  });

  it("renders a 'Go to Home' link pointing to '/'", async () => {
    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Go to Home" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/");
    });
  });

  it("does NOT render children when unauthenticated", async () => {
    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    });
  });

  it("treats session with no user as unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: null } } });

    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign in required")).toBeInTheDocument();
    });
  });
});

// ── Authenticated state ───────────────────────────────────────────────────────
describe("AuthGuard – authenticated", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession() } });
  });

  it("renders children when user is authenticated", async () => {
    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });
  });

  it("does NOT render the loading spinner after session resolves", async () => {
    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.queryByText("Checking authentication...")).not.toBeInTheDocument();
    });
  });

  it("does NOT render 'Sign in required' for authenticated users", async () => {
    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.queryByText("Sign in required")).not.toBeInTheDocument();
    });
  });

  it("renders multiple children correctly", async () => {
    renderGuard(
      <AuthGuard>
        <p>Child one</p>
        <p>Child two</p>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Child one")).toBeInTheDocument();
      expect(screen.getByText("Child two")).toBeInTheDocument();
    });
  });
});

// ── Auth state change subscription ───────────────────────────────────────────
describe("AuthGuard – auth state change subscription", () => {
  it("subscribes to onAuthStateChange on mount", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession() } });

    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalledOnce();
    });
  });

  it("unsubscribes from auth state changes on unmount", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession() } });

    const { unmount } = renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("updates to unauthenticated when auth state changes to signed-out", async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession() } });

    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });

    capturedCallback!("SIGNED_OUT", null);

    await waitFor(() => {
      expect(screen.getByText("Sign in required")).toBeInTheDocument();
    });
  });

  it("updates to authenticated when auth state changes to signed-in", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    let capturedCallback: ((event: string, session: unknown) => void) | null = null;
    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    renderGuard(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign in required")).toBeInTheDocument();
    });

    capturedCallback!("SIGNED_IN", fakeSession());

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });
  });
});
