/**
 * public.leads has no consent column — strip envelope before insert/update rows.
 */
export function stripConsentForLeadsInsert<T extends { consent?: unknown }>(
  payload: T,
): Omit<T, "consent"> {
  const { consent: _consentEnvelope, ...leadPayload } = payload;
  return leadPayload;
}
