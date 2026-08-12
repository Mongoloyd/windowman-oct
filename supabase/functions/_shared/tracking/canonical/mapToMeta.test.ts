import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapToMeta } from "./mapToMeta.ts";
import type { WMCanonicalEvent } from "./types.ts";

function callbackEvent(
  overrides: Partial<WMCanonicalEvent> = {},
): WMCanonicalEvent {
  return {
    eventId: "wmc_callback_requested_lead-a_scan-b",
    eventName: "callback_requested",
    eventTimestamp: "2026-08-12T10:00:00.000Z",
    schemaVersion: "1.0.0",
    dispatchStatus: "pending",
    identityQuality: "high",
    shouldSendMeta: true,
    shouldSendGoogle: false,
    shouldSendNextdoor: false,
    payload: {
      identity: {
        leadId: "lead-1",
        phoneHash: "b".repeat(64),
        fbp: "fb.1.1",
      },
      journey: { route: "/diagnosis", flow: "public" },
    },
    ...overrides,
  };
}

Deno.test("callback_requested maps to Meta Contact with stable event_id", () => {
  const canonical = callbackEvent();
  const mapped = mapToMeta(canonical, "https://windowman.example/diagnosis");
  assertEquals(mapped.suppressed, false);
  assertEquals(mapped.payload?.event_name, "Contact");
  assertEquals(mapped.payload?.event_id, canonical.eventId);
  assertEquals(mapped.payload?.action_source, "website");
  assertEquals(mapped.payload?.custom_data?.event_name_internal, "callback_requested");
  assertEquals(mapped.payload?.user_data.ph, "b".repeat(64));
  assertEquals(
    JSON.stringify(mapped.payload).includes("555"),
    false,
  );
});

Deno.test("callback_requested is not mapped to Schedule", () => {
  const mapped = mapToMeta(
    callbackEvent(),
    "https://windowman.example/diagnosis",
  );
  assertEquals(mapped.payload?.event_name, "Contact");
  assertEquals(mapped.payload?.event_name === "Schedule", false);
});
