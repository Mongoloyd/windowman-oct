const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidLeadSessionUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}

export function hasTrustedContactIdentity(
  leadId: string | null | undefined,
  sessionId: string | null | undefined,
): boolean {
  return isValidLeadSessionUuid(leadId) && isValidLeadSessionUuid(sessionId);
}
