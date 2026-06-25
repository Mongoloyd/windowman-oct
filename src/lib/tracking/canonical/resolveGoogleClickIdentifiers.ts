import type { WMIdentityPayload } from "./types.ts";

export interface GoogleClickIdentifierSources {
  identity?: WMIdentityPayload | null;
  attribution?: Record<string, unknown> | null;
  queryParams?: Record<string, unknown> | null;
}

export interface ResolvedGoogleClickIdentifiers {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickFromQueryParams(
  queryParams: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = queryParams?.[key];
  if (typeof value === "string") {
    return nonEmptyString(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const picked = nonEmptyString(item);
      if (picked) return picked;
    }
  }
  return undefined;
}

function pickClickId(
  identity: WMIdentityPayload | null | undefined,
  attribution: Record<string, unknown> | null | undefined,
  queryParams: Record<string, unknown> | null | undefined,
  key: "gclid" | "gbraid" | "wbraid",
): string | undefined {
  return (
    nonEmptyString(identity?.[key]) ??
    nonEmptyString(attribution?.[key]) ??
    pickFromQueryParams(queryParams, key)
  );
}

/**
 * Resolve Google click IDs with priority: identity → attribution → query_params.
 * Does not read raw email/phone — hashed PII remains on payload.identity.
 */
export function resolveGoogleClickIdentifiers(
  sources: GoogleClickIdentifierSources,
): ResolvedGoogleClickIdentifiers {
  const { identity, attribution, queryParams } = sources;
  const resolved: ResolvedGoogleClickIdentifiers = {};

  const gclid = pickClickId(identity, attribution, queryParams, "gclid");
  const gbraid = pickClickId(identity, attribution, queryParams, "gbraid");
  const wbraid = pickClickId(identity, attribution, queryParams, "wbraid");

  if (gclid) resolved.gclid = gclid;
  if (gbraid) resolved.gbraid = gbraid;
  if (wbraid) resolved.wbraid = wbraid;

  return resolved;
}
