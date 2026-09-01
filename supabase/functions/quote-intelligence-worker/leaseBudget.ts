export interface LeaseBudgetInput {
  jobLeaseExpiresAt: Date;
  contentLeaseExpiresAt: Date;
  providerTimeoutMs: number;
  safetyMarginMs: number;
  now: Date;
}

export function remainingMs(expiresAt: Date, now: Date): number {
  return expiresAt.getTime() - now.getTime();
}

/**
 * Provider work may start only when both job and content leases outlive
 * timeout + safety margin. No heartbeat exists on the dormant contract.
 */
export function hasSufficientLeaseBudget(input: LeaseBudgetInput): boolean {
  const required = input.providerTimeoutMs + input.safetyMarginMs;
  if (required <= 0) return false;
  const jobRemaining = remainingMs(input.jobLeaseExpiresAt, input.now);
  const contentRemaining = remainingMs(
    input.contentLeaseExpiresAt,
    input.now,
  );
  return jobRemaining > required && contentRemaining > required;
}
