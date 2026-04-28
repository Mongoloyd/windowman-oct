import { beforeEach, describe, expect, it, vi } from "vitest";
import { finalizeSupabaseAuthLink } from "./supabaseAuthLink";

const mockAuth = vi.hoisted(() => ({
  session: null as null | { access_token: string; refresh_token?: string; user: { id: string } },
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: mockAuth },
}));

function setUrl(path: string) {
  window.history.replaceState({}, "", path);
}

describe("finalizeSupabaseAuthLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.session = null;
    mockAuth.exchangeCodeForSession.mockImplementation(async () => ({
      data: { session: { access_token: "session-token", user: { id: "user-1" } } },
      error: null,
    }));
    mockAuth.setSession.mockImplementation(async ({ access_token, refresh_token }) => ({
      data: { session: { access_token, refresh_token, user: { id: "user-1" } } },
      error: null,
    }));
    mockAuth.getSession.mockImplementation(async () => ({ data: { session: mockAuth.session }, error: null }));
  });

  it("exchanges PKCE code links and preserves safe invite params when cleaning", async () => {
    setUrl("/partner/accept-invite?token=invite-123&code=pkce-code&type=invite");
    mockAuth.exchangeCodeForSession.mockImplementationOnce(async () => {
      mockAuth.session = { access_token: "new-session", user: { id: "user-1" } };
      return { data: { session: mockAuth.session }, error: null };
    });

    const result = await finalizeSupabaseAuthLink({ expectedType: "invite", cleanUrl: true });

    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(result.ok).toBe(true);
    expect(result.source).toBe("pkce_code");
    expect(window.location.pathname + window.location.search).toBe("/partner/accept-invite?token=invite-123");
    expect(window.location.hash).toBe("");
  });

  it("sets a session from hash tokens without logging or exposing raw tokens", async () => {
    setUrl("/admin/reset-password#access_token=hash-access&refresh_token=hash-refresh&type=recovery");
    mockAuth.setSession.mockImplementationOnce(async ({ access_token, refresh_token }) => {
      mockAuth.session = { access_token, refresh_token, user: { id: "user-1" } };
      return { data: { session: mockAuth.session }, error: null };
    });

    const result = await finalizeSupabaseAuthLink({ expectedType: "recovery", cleanUrl: true });

    expect(mockAuth.setSession).toHaveBeenCalledWith({ access_token: "hash-access", refresh_token: "hash-refresh" });
    expect(result.ok).toBe(true);
    expect(result.source).toBe("hash_tokens");
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/admin/reset-password");
  });

  it("returns structured failure for invalid links", async () => {
    setUrl("/admin/reset-password?code=expired-code&type=recovery");
    mockAuth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "Auth code is invalid or expired" },
    });

    const result = await finalizeSupabaseAuthLink({ expectedType: "recovery", cleanUrl: true });

    expect(result.ok).toBe(false);
    expect(result.session).toBeNull();
    expect(result.error).toBe("Auth code is invalid or expired");
    expect(window.location.search).toContain("code=expired-code");
  });
});
