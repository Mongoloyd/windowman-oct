/**
 * Tests for adminDataService.ts
 * Covers: isAdminDataError, getErrorMessage, invokeAdminData, listUserRoles, getRoleAuditLog
 *
 * UPDATED: Tests now mock supabase.auth.getSession() and expect the
 * Authorization header to be present in invoke calls (auth fix).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isAdminDataError,
  getErrorMessage,
  invokeAdminData,
  listUserRoles,
  getRoleAuditLog,
  type AdminDataError,
} from "./adminDataService";

// ── Mock the supabase client ──────────────────────────────────────────────────
const { mockInvoke, mockGetSession } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    auth: {
      getSession: mockGetSession,
    },
  },
}));

// ── Helper: mock a valid session ──────────────────────────────────────────────
const MOCK_ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.mock-test-token";

function mockValidSession() {
  mockGetSession.mockResolvedValueOnce({
    data: {
      session: {
        access_token: MOCK_ACCESS_TOKEN,
        user: { id: "test-user-id", email: "admin@windowman.app" },
      },
    },
    error: null,
  });
}

function mockNoSession() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: null },
    error: null,
  });
}

function mockSessionError() {
  mockGetSession.mockResolvedValueOnce({
    data: { session: null },
    error: { message: "Session expired" },
  });
}

// ── isAdminDataError ──────────────────────────────────────────────────────────
describe("isAdminDataError", () => {
  it("returns true for a valid AdminDataError object", () => {
    const err: AdminDataError = { code: "some_code", message: "oops", status: 403 };
    expect(isAdminDataError(err)).toBe(true);
  });

  it("returns false when 'code' property is missing", () => {
    expect(isAdminDataError({ message: "oops", status: 403 })).toBe(false);
  });

  it("returns false when 'message' property is missing", () => {
    expect(isAdminDataError({ code: "err", status: 403 })).toBe(false);
  });

  it("returns false when 'status' property is missing", () => {
    expect(isAdminDataError({ code: "err", message: "oops" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAdminDataError(null)).toBe(false);
  });

  it("returns false for a plain string", () => {
    expect(isAdminDataError("some error string")).toBe(false);
  });

  it("returns false for an Error instance (missing 'code' and 'status')", () => {
    expect(isAdminDataError(new Error("oops"))).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isAdminDataError(42)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAdminDataError(undefined)).toBe(false);
  });

  it("returns true even when property values are empty or zero", () => {
    expect(isAdminDataError({ code: "", message: "", status: 0 })).toBe(true);
  });
});

// ── getErrorMessage ───────────────────────────────────────────────────────────
describe("getErrorMessage", () => {
  it("returns message from AdminDataError", () => {
    const err: AdminDataError = { code: "forbidden", message: "Access denied", status: 403 };
    expect(getErrorMessage(err)).toBe("Access denied");
  });

  it("returns message from a native Error instance", () => {
    expect(getErrorMessage(new Error("network failure"))).toBe("network failure");
  });

  it("returns the string itself when error is a plain string", () => {
    expect(getErrorMessage("something went wrong")).toBe("something went wrong");
  });

  it("returns fallback message for an unknown object", () => {
    expect(getErrorMessage({ foo: "bar" })).toBe("An unexpected error occurred");
  });

  it("returns fallback message for null", () => {
    expect(getErrorMessage(null)).toBe("An unexpected error occurred");
  });

  it("returns fallback message for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("An unexpected error occurred");
  });

  it("returns fallback message for a number", () => {
    expect(getErrorMessage(42)).toBe("An unexpected error occurred");
  });

  it("prefers AdminDataError message over Error fallback when object qualifies as both", () => {
    const hybrid = { code: "err", message: "admin msg", status: 500 };
    expect(getErrorMessage(hybrid)).toBe("admin msg");
  });

  it("returns empty string when AdminDataError message is empty string", () => {
    const err: AdminDataError = { code: "err", message: "", status: 500 };
    expect(getErrorMessage(err)).toBe("");
  });
});

// ── invokeAdminData ───────────────────────────────────────────────────────────
describe("invokeAdminData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getSession then invoke with correct function name, body, and auth header", async () => {
    mockValidSession();
    mockInvoke.mockResolvedValueOnce({ data: { data: { users: [] } }, error: null });

    await invokeAdminData("list_user_roles");

    expect(mockGetSession).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith("admin-data", {
      body: { action: "list_user_roles", payload: {} },
      headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
    });
  });

  it("passes payload through to the invoke call", async () => {
    mockValidSession();
    mockInvoke.mockResolvedValueOnce({ data: { data: { entries: [] } }, error: null });

    await invokeAdminData("get_role_audit_log", { limit: 50 });

    expect(mockInvoke).toHaveBeenCalledWith("admin-data", {
      body: { action: "get_role_audit_log", payload: { limit: 50 } },
      headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
    });
  });

  it("returns data.data from the invoke response", async () => {
    mockValidSession();
    const payload = { users: [{ id: "u1", role: "viewer" }] };
    mockInvoke.mockResolvedValueOnce({ data: { data: payload }, error: null });

    const result = await invokeAdminData("list_user_roles");
    expect(result).toEqual(payload);
  });

  it("throws an AdminDataError when supabase returns an error", async () => {
    mockValidSession();
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "Edge function crashed", status: 500 },
    });

    await expect(invokeAdminData("list_user_roles")).rejects.toMatchObject({
      code: "invocation_error",
      message: "Edge function crashed",
      status: 500,
    });
  });

  it("falls back to default status 500 when error has no status field", async () => {
    mockValidSession();
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "no status here" },
    });

    await expect(invokeAdminData("list_user_roles")).rejects.toMatchObject({
      code: "invocation_error",
      status: 500,
    });
  });

  it("uses default fallback message when error.message is empty", async () => {
    mockValidSession();
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: "", status: 503 },
    });

    await expect(invokeAdminData("list_user_roles")).rejects.toMatchObject({
      message: "Failed to contact admin-data",
    });
  });

  // ── New: auth-specific tests ──────────────────────────────────────────
  it("throws auth_error when session is null (not logged in)", async () => {
    mockNoSession();

    await expect(invokeAdminData("fetch_leads")).rejects.toMatchObject({
      code: "auth_error",
      status: 401,
      message: "User is not authenticated or session has expired.",
    });

    // Should never reach invoke
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("throws auth_error when getSession returns an error", async () => {
    mockSessionError();

    await expect(invokeAdminData("fetch_leads")).rejects.toMatchObject({
      code: "auth_error",
      status: 401,
    });

    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

// ── listUserRoles ─────────────────────────────────────────────────────────────
describe("listUserRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes admin-data with list_user_roles action and auth header", async () => {
    mockValidSession();
    const mockResponse = {
      users: [
        { id: "u1", user_id: "u1", email: "a@b.com", role: "operator" as const, last_sign_in: null, updated_at: null },
      ],
    };
    mockInvoke.mockResolvedValueOnce({ data: { data: mockResponse }, error: null });

    const result = await listUserRoles();

    expect(mockInvoke).toHaveBeenCalledWith("admin-data", {
      body: { action: "list_user_roles", payload: {} },
      headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
    });
    expect(result).toEqual(mockResponse);
  });

  it("propagates errors thrown by invokeAdminData", async () => {
    mockValidSession();
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: "Unauthorized", status: 403 } });

    await expect(listUserRoles()).rejects.toMatchObject({ status: 403 });
  });
});

// ── getRoleAuditLog ───────────────────────────────────────────────────────────
describe("getRoleAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes admin-data with get_role_audit_log and default limit of 100", async () => {
    mockValidSession();
    const mockResponse = { entries: [] };
    mockInvoke.mockResolvedValueOnce({ data: { data: mockResponse }, error: null });

    const result = await getRoleAuditLog();

    expect(mockInvoke).toHaveBeenCalledWith("admin-data", {
      body: { action: "get_role_audit_log", payload: { limit: 100 } },
      headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
    });
    expect(result).toEqual(mockResponse);
  });

  it("passes a custom limit to the payload", async () => {
    mockValidSession();
    mockInvoke.mockResolvedValueOnce({ data: { data: { entries: [] } }, error: null });

    await getRoleAuditLog(25);

    expect(mockInvoke).toHaveBeenCalledWith("admin-data", {
      body: { action: "get_role_audit_log", payload: { limit: 25 } },
      headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
    });
  });

  it("returns enriched audit log entries from the response", async () => {
    mockValidSession();
    const entry = {
      id: "e1",
      target_user_id: "u1",
      target_email: "target@example.com",
      changed_by_user_id: "u2",
      changed_by_email: "changer@example.com",
      old_role: "operator",
      new_role: "super_admin" as const,
      action: "role_change",
      created_at: "2024-01-01T00:00:00Z",
    };
    mockInvoke.mockResolvedValueOnce({ data: { data: { entries: [entry] } }, error: null });

    const result = await getRoleAuditLog();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toEqual(entry);
  });

  it("propagates errors thrown by invokeAdminData", async () => {
    mockValidSession();
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: "Forbidden", status: 403 } });

    await expect(getRoleAuditLog()).rejects.toMatchObject({ status: 403 });
  });

  it("handles limit of 1 as boundary value", async () => {
    mockValidSession();
    mockInvoke.mockResolvedValueOnce({ data: { data: { entries: [] } }, error: null });

    await getRoleAuditLog(1);

    expect(mockInvoke).toHaveBeenCalledWith("admin-data", {
      body: { action: "get_role_audit_log", payload: { limit: 1 } },
      headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` },
    });
  });
});
