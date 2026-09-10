import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureQuoteEducationDemoLead } from "@/lib/captureQuoteEducationDemoLead";
import { getAttributionPayload } from "@/lib/useUtmCapture";
import { buildDemoAttribution, productionCaptureClient } from "./productionCaptureClient";
import { SAMPLE_QUOTE } from "./fixture";
import type { SyntheticDemoCreateInput } from "./types";

vi.mock("@/lib/captureQuoteEducationDemoLead", () => ({ captureQuoteEducationDemoLead: vi.fn() }));
vi.mock("@/lib/useUtmCapture", () => ({ getAttributionPayload: vi.fn() }));
const capture = vi.mocked(captureQuoteEducationDemoLead);
const leadId = "11111111-1111-4111-8111-111111111111";
const input: SyntheticDemoCreateInput = { contact: { firstName: "Taylor", email: "taylor@example.test" }, variant: "xray",
  attribution: { sourcePath: "/prophecy", entryPoint: "prophecy_hero_sample_audit" }, fixtureId: SAMPLE_QUOTE.id };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAttributionPayload).mockReturnValue({ utm_source: "campaign", fbclid: "click-123", gclid: "gclick-321",
    landing_page: "/prophecy", landing_page_url: "https://windowman.app/prophecy?email=secret@example.test&utm_source=campaign",
    current_page_url: "https://windowman.app/leads/taylor@example.test",
    latest_touch_page_url: "https://windowman.app/leads/taylor%40example.test",
    referrer: "https://example.test/article?email=secret@example.test", query_params: { utm_medium: "paid", email: "secret@example.test", phone: "5551234567" },
    raw_query_string: "email=secret@example.test" });
  capture.mockImplementation(async (payload) => ({ ok: true, leadId, sessionId: String(payload.session_id), source: "quote-education-demo" }));
});
describe("production synthetic capture adapter", () => {
  it("rejects arbitrary fixture metadata before a write", async () => {
    const session = productionCaptureClient.startSession();
    expect(await session.create({ ...input, fixtureId: "taylor@example.test" })).toMatchObject({ ok: false });
    expect(capture).not.toHaveBeenCalled();
  });
  it("internally fixes source and one secure session across every action", async () => {
    const session = productionCaptureClient.startSession();
    expect(session.sessionId).toMatch(/^[\da-f-]{36}$/);
    await session.create(input);
    await session.updateZip(leadId, "33301");
    await session.updatePhone(leadId, "3055550100");
    await session.updateIntake(leadId, { status: "Just researching options", scope: "1 to 5 Openings" });
    expect(capture.mock.calls.map(([payload]) => payload.action)).toEqual(["create", "update_zip", "update_phone", "update_intake"]);
    for (const [payload] of capture.mock.calls) expect(payload).toMatchObject({ source: "quote-education-demo", session_id: session.sessionId });
    expect(capture.mock.calls[0][0]).toMatchObject({
      variant: "xray",
      host_page: "/prophecy",
      entry_point: "prophecy_hero_sample_audit",
      fixture_id: SAMPLE_QUOTE.id,
    });
    expect(productionCaptureClient.startSession().sessionId).not.toBe(session.sessionId);
  });
  it("deduplicates concurrent creates and reuses the trusted result", async () => {
    let resolveRequest: (value: Awaited<ReturnType<typeof captureQuoteEducationDemoLead>>) => void = () => undefined;
    capture.mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const session = productionCaptureClient.startSession();
    const first = session.create(input);
    const second = session.create(input);
    expect(first).toBe(second);
    expect(capture).toHaveBeenCalledTimes(1);
    resolveRequest({ ok: true, leadId, sessionId: session.sessionId, source: "quote-education-demo" });
    await first;
    await session.create(input);
    expect(capture).toHaveBeenCalledTimes(1);
  });
  it("allows retry after failure without accepting a wrong session", async () => {
    capture.mockResolvedValueOnce({ ok: true, leadId, sessionId: "33333333-3333-4333-8333-333333333333", source: "quote-education-demo" });
    const session = productionCaptureClient.startSession();
    expect(await session.create(input)).toMatchObject({ ok: false });
    expect(await session.updateZip(leadId, "33301")).toMatchObject({ ok: false });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(await session.create(input)).toMatchObject({ ok: true });
  });
  it("preserves approved attribution but never projects contact, arbitrary queries or extra props", async () => {
    const projected = buildDemoAttribution(input);
    expect(projected).toMatchObject({ utm_source: "campaign", fbclid: "click-123", gclid: "gclick-321",
      first_page_path: "/prophecy", initial_referrer: "https://example.test/article",
      query_params: { utm_medium: "paid", synthetic_demo_variant: "xray", synthetic_demo_host_path: "/prophecy",
        synthetic_demo_entry_point: "prophecy_hero_sample_audit", synthetic_demo_fixture_id: SAMPLE_QUOTE.id } });
    expect(projected).not.toHaveProperty("current_page_url");
    expect(projected).not.toHaveProperty("latest_touch_page_url");
    expect(JSON.stringify(projected)).not.toMatch(/Taylor|example\.test.*email|secret@|taylor(?:@|%40)|5551234567|raw_query_string/);
    await productionCaptureClient.startSession().create(input);
    expect(capture.mock.calls[0][0]).toMatchObject({ first_name: "Taylor", email: "taylor@example.test" });
    expect(JSON.stringify(capture.mock.calls[0][0].attribution)).not.toContain("Taylor");
  });
});
