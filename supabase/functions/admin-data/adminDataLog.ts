/**
 * Local structured logging for admin-data (avoids depending on dirty shared adminAuth helpers).
 */

export function formatErrorForLog(error: unknown): {
  error_code: string | null;
  error_name: string | null;
} {
  if (error instanceof Error) {
    return {
      error_code: null,
      error_name: error.name || "Error",
    };
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const rawCode = typeof record.code === "string" ? record.code : null;
    const rawName = typeof record.name === "string" ? record.name : null;
    return {
      error_code: rawCode && /^[A-Z0-9_]+$/i.test(rawCode) ? rawCode : null,
      error_name: rawName && /^[A-Z][A-Za-z0-9_]*$/.test(rawName)
        ? rawName
        : null,
    };
  }
  return { error_code: null, error_name: null };
}

function safeContext(context?: Record<string, unknown>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const key of ["action", "phase", "lead_id"]) {
    const value = context?.[key];
    if (typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value)) {
      safe[key] = value;
    }
  }
  return safe;
}

export function logStructuredError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const formatted = formatErrorForLog(error);
  console.error(`[${scope}] operation failed`, {
    ...safeContext(context),
    ...formatted,
  });
}
