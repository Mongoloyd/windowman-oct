import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { captureQuoteEducationDemoLead } from "./captureQuoteEducationDemoLead";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const invoke = vi.mocked(supabase.functions.invoke);

beforeEach(() => vi.clearAllMocks());

describe("captureQuoteEducationDemoLead", () => {
  it("invokes only the quote education sibling function", async () => {
    invoke.mockResolvedValue({
      data: {
        success: true,
        lead_id: "11111111-1111-4111-8111-111111111111",
        session_id: "22222222-2222-4222-8222-222222222222",
        stage: "demo_created",
        source: "quote-education-demo",
      },
      error: null,
    });
    const payload = { action: "create", source: "quote-education-demo" };

    await expect(captureQuoteEducationDemoLead(payload)).resolves.toMatchObject({
      ok: true,
      source: "quote-education-demo",
    });
    expect(invoke).toHaveBeenCalledWith(
      "capture-quote-education-demo-lead",
      { body: payload },
    );
  });

  it("does not trust a successful response carrying the classic source", async () => {
    invoke.mockResolvedValue({
      data: { success: true, source: "power-tool-demo" },
      error: null,
    });

    await expect(captureQuoteEducationDemoLead({})).resolves.toEqual({
      ok: false,
      code: "invalid_response_source",
      message: "We could not save that yet. Please try again.",
    });
  });

  it("returns a generic recoverable error for invocation failures", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("private detail") });
    await expect(captureQuoteEducationDemoLead({})).resolves.toEqual({
      ok: false,
      code: "invoke_failed",
      message: "We could not save that yet. Please try again.",
    });
  });
});
