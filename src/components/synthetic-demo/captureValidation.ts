import { isValidLeadSessionUuid } from "@/lib/leadSession";

export const CAPTURE_ERROR = "We could not save that yet. Your details are still here. Please try again.";
export interface TrustedDemoLead {
  leadId: string;
  sessionId: string;
  source: "quote-education-demo";
}
export function trustedDemoLead(result: unknown, sessionId: string): TrustedDemoLead | null {
  if (!result || typeof result !== "object") return null;
  const candidate = result as Record<string, unknown>;
  if (candidate.ok !== true || candidate.source !== "quote-education-demo" ||
      !isValidLeadSessionUuid(candidate.leadId) || !isValidLeadSessionUuid(candidate.sessionId) ||
      candidate.sessionId !== sessionId) return null;
  return { leadId: candidate.leadId, sessionId: candidate.sessionId, source: "quote-education-demo" };
}
