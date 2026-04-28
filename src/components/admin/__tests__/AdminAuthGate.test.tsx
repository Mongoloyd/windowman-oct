/**
 * AdminAuthGate — integration tests
 *
 * Verifies that in production mode (DEV bypass off):
 *   - Anonymous users on any /admin route are redirected to /admin/login
 *     (with the original path captured in router state).
 *   - Authenticated users reach protected children regardless of JWT role
 *     claims; backend admin-data/user_roles remains the role authority.
 *   - SIGNED_OUT events fired mid-session evict the user immediately.
 *
 * Each scenario is run against every admin route (/admin, /admin/settings,
 * /admin/partners, /admin/leads, /admin/leads/:id) so future routes added
 * through AdminAuthGate inherit the same coverage matrix.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";

// ── Hoisted mock state — required because vi.mock factories run before imports
const mockState = vi.hoisted(() => {
  type Listener = (event: string, session: unknown) => void;
  return {
    session: null as null | { user: { email: string }; access_token: string },
    listeners: [] as Listener[],
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: mockState.session } })),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        mockState.listeners.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

/**
 * Build a fake JWT whose payload encodes app_metadata.role. We do NOT need
 * a valid signature — decodeJwtRole only base64-decodes the payload segment.
 */
function buildJwt(role: string | null): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: "user-uuid",
      email: "test@example.com",
      app_metadata: role === null ? {} : { role },
    }),
  );
  return `${header}.${payload}.fake-signature`;
}

function setSession(role: string | null | "anonymous") {
  if (role === "anonymous") {
    mockState.session = null;
  } else {
    mockState.session = {
      user: { email: "test@example.com" },
      access_token: buildJwt(role),
    };
  }
}

function renderGated(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminAuthGate>
              <div data-testid="admin-dashboard">Admin Dashboard</div>
            </AdminAuthGate>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminAuthGate>
              <div data-testid="admin-settings">Admin Settings</div>
            </AdminAuthGate>
          }
        />
        <Route
          path="/admin/partners"
          element={
            <AdminAuthGate>
              <div data-testid="admin-partners">Admin Partners</div>
            </AdminAuthGate>
          }
        />
        <Route
          path="/admin/leads"
          element={
            <AdminAuthGate>
              <div data-testid="admin-leads">Admin Lead Inbox</div>
            </AdminAuthGate>
          }
        />
        <Route
          path="/admin/leads/:id"
          element={
            <AdminAuthGate>
              <div data-testid="admin-lead-dossier">Admin Lead Dossier</div>
            </AdminAuthGate>
          }
        />
        <Route
          path="/admin/login"
          element={<div data-testid="login-page">Login Page</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const ADMIN_ROUTES = [
  "/admin",
  "/admin/settings",
  "/admin/partners",
  "/admin/leads",
  "/admin/leads/abc-123",
] as const;
const ROUTE_TESTID: Record<(typeof ADMIN_ROUTES)[number], string> = {
  "/admin": "admin-dashboard",
  "/admin/settings": "admin-settings",
  "/admin/partners": "admin-partners",
  "/admin/leads": "admin-leads",
  "/admin/leads/abc-123": "admin-lead-dossier",
};

describe("AdminAuthGate (production mode — DEV bypass disabled)", () => {
  beforeEach(() => {
    // Force the production code path: AdminAuthGate short-circuits when
    // import.meta.env.DEV is true. vi.stubEnv flips it to false so
    // ProductionAdminAuthGate runs.
    // @ts-expect-error vitest accepts string for env stubbing despite Vite's boolean DEV typing
    vi.stubEnv("DEV", "");
    mockState.session = null;
    mockState.listeners = [];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("anonymous users", () => {
    it.each(ADMIN_ROUTES)("redirects %s to /admin/login", async (route) => {
      setSession("anonymous");
      renderGated(route);

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });
      expect(screen.queryByTestId(ROUTE_TESTID[route])).not.toBeInTheDocument();
    });
  });

  describe("authenticated users", () => {
    const JWT_ROLES = ["viewer", "homeowner", "contractor", null, "operator", "admin", "super_admin"] as const;

    for (const role of JWT_ROLES) {
      describe(`role = ${role === null ? "<none>" : `"${role}"`}`, () => {
        it.each(ADMIN_ROUTES)("renders the protected children at %s", async (route) => {
          setSession(role);
          renderGated(route);

          await waitFor(() => {
            expect(screen.getByTestId(ROUTE_TESTID[route])).toBeInTheDocument();
          });
          expect(screen.queryByText(/not authorized/i)).not.toBeInTheDocument();
          expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
        });
      });
    }
  });

  describe("session lifecycle", () => {
    it("evicts an authorized admin when SIGNED_OUT fires mid-session", async () => {
      setSession("operator");
      renderGated("/admin");

      await waitFor(() => {
        expect(screen.getByTestId("admin-dashboard")).toBeInTheDocument();
      });

      // Simulate the user signing out from another tab / explicit sign-out.
      mockState.session = null;
      act(() => {
        mockState.listeners.forEach((cb) => cb("SIGNED_OUT", null));
      });

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("admin-dashboard")).not.toBeInTheDocument();
    });

    it("continues rendering when JWT role claims change mid-session", async () => {
      setSession("viewer");
      renderGated("/admin");

      await waitFor(() => {
        expect(screen.getByTestId("admin-dashboard")).toBeInTheDocument();
      });

      // Backend user_roles is authoritative; token role claim changes should
      // not decide route access in this client gate.
      mockState.session = {
        user: { email: "test@example.com" },
        access_token: buildJwt("operator"),
      };
      act(() => {
        mockState.listeners.forEach((cb) => cb("TOKEN_REFRESHED", mockState.session));
      });

      await waitFor(() => {
        expect(screen.getByTestId("admin-dashboard")).toBeInTheDocument();
      });
      expect(screen.queryByText(/not authorized/i)).not.toBeInTheDocument();
    });
  });
});
