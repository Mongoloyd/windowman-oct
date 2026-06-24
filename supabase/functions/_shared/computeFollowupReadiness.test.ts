import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeFollowupReadiness,
  hasLeadContact,
} from "./computeFollowupReadiness.ts";

Deno.test("computeFollowupReadiness quote_uploaded splits on contact", () => {
  assertEquals(
    computeFollowupReadiness({ eventName: "quote_uploaded", hasContact: true }),
    "follow_up_ready",
  );
  assertEquals(
    computeFollowupReadiness({ eventName: "quote_uploaded", hasContact: false }),
    "high_intent_contact_missing",
  );
});

Deno.test("computeFollowupReadiness contact forms require contact", () => {
  assertEquals(
    computeFollowupReadiness({
      eventName: "truth_gate_captured",
      hasContact: true,
    }),
    "follow_up_ready",
  );
  assertEquals(
    computeFollowupReadiness({
      eventName: "truth_gate_captured",
      hasContact: false,
    }),
    "not_follow_up_ready",
  );
});

Deno.test("hasLeadContact detects phone or email", () => {
  assertEquals(hasLeadContact({ phone_e164: "+15551234567" }), true);
  assertEquals(hasLeadContact({ email: "a@b.com" }), true);
  assertEquals(hasLeadContact({}), false);
});
