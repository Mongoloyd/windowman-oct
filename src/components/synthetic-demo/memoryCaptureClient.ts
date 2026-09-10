import type { SyntheticDemoCaptureClient } from "./types";

/** Deterministic local QA responses. No transport, storage, or vendor imports. */
export function createMemoryCaptureClient(): SyntheticDemoCaptureClient {
  let opening = 0;
  return {
    startSession() {
      opening += 1;
      const tail = String(opening).padStart(12, "0");
      const sessionId = `aaaaaaaa-bbbb-4ccc-8ddd-${tail}`;
      const leadId = `11111111-2222-4333-8444-${tail}`;
      const success = async () => ({ ok: true, leadId, sessionId, source: "quote-education-demo" });
      return { sessionId, create: success, updateZip: success, updatePhone: success, updateIntake: success };
    },
  };
}
