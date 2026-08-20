export type RouteClass = "tenant_required" | "platform_owned" | "unresolved";

export interface RouteOwnershipInput {
  eventName: string;
  eventClientSlug?: string | null;
  eventLeadId?: string | null;
  eventScanSessionId?: string | null;
  eventAnalysisId?: string | null;
  eventQuoteFileId?: string | null;
  /** Server-minted canonical scope; never sourced from browser attribution. */
  eventMeasurementScope?: string | null;
  attemptCount: number;
}

export interface RouteOwnershipResult {
  routeClass: RouteClass;
  verifiedClientSlug: string | null;
  reason: string;
  allowDefaultPixel: boolean;
  allowEnvFallback: boolean;
}

export const WMCHAT_DAY1_META_SCOPE = "wmchat_day1_lead" as const;

function isPlatformOwnedWmChatLead(input: RouteOwnershipInput): boolean {
  return input.eventName === "lead_captured" &&
    input.eventMeasurementScope === WMCHAT_DAY1_META_SCOPE;
}

export interface OwnershipResolutionDB {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{
          data: Record<string, unknown> | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
}

export interface OwnershipResolutionInput {
  eventLogId: string;
  eventClientSlug?: string | null;
  eventLeadId?: string | null;
  eventScanSessionId?: string | null;
  eventAnalysisId?: string | null;
  eventQuoteFileId?: string | null;
}

export interface OwnershipResolutionResult {
  slug: string | null;
  leadId: string | null;
  scanSessionId: string | null;
  analysisId: string | null;
  quoteFileId: string | null;
}

export function normalizeClientSlug(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEntityId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasEntityIds(input: RouteOwnershipInput): boolean {
  return Boolean(
    input.eventLeadId ||
      input.eventScanSessionId ||
      input.eventAnalysisId ||
      input.eventQuoteFileId,
  );
}

async function lookupTableClientSlug(
  db: OwnershipResolutionDB,
  table: "leads" | "scan_sessions" | "analyses",
  id: string,
): Promise<string | null> {
  const { data, error } = await db
    .from(table)
    .select("client_slug")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return normalizeClientSlug(data?.client_slug);
}

export function classifyRouteOwnership(
  input: RouteOwnershipInput,
): RouteOwnershipResult {
  const verifiedSlug = normalizeClientSlug(input.eventClientSlug);

  if (verifiedSlug) {
    return {
      routeClass: "tenant_required",
      verifiedClientSlug: verifiedSlug,
      reason: "tenant_slug_verified",
      allowDefaultPixel: false,
      allowEnvFallback: false,
    };
  }

  if (isPlatformOwnedWmChatLead(input)) {
    return {
      routeClass: "platform_owned",
      verifiedClientSlug: null,
      reason: "platform_owned_wmchat_lead",
      allowDefaultPixel: true,
      allowEnvFallback: true,
    };
  }

  if (hasEntityIds(input)) {
    return {
      routeClass: "unresolved",
      verifiedClientSlug: null,
      reason: "missing_client_slug",
      allowDefaultPixel: false,
      allowEnvFallback: false,
    };
  }

  return {
    routeClass: "unresolved",
    verifiedClientSlug: null,
    reason: "platform_default_not_allowed",
    allowDefaultPixel: false,
    allowEnvFallback: false,
  };
}

export async function resolveVerifiedClientSlug(
  db: OwnershipResolutionDB,
  input: OwnershipResolutionInput,
): Promise<OwnershipResolutionResult> {
  let slug = normalizeClientSlug(input.eventClientSlug);
  let leadId = normalizeEntityId(input.eventLeadId);
  let scanSessionId = normalizeEntityId(input.eventScanSessionId);
  let analysisId = normalizeEntityId(input.eventAnalysisId);
  let quoteFileId = normalizeEntityId(input.eventQuoteFileId);

  if (slug) {
    return { slug, leadId, scanSessionId, analysisId, quoteFileId };
  }

  if (input.eventLogId) {
    const { data, error } = await db
      .from("wm_event_log")
      .select("client_slug, lead_id, scan_session_id, analysis_id, quote_file_id")
      .eq("id", input.eventLogId)
      .maybeSingle();

    if (!error && data) {
      slug = normalizeClientSlug(data.client_slug);
      leadId = leadId ?? normalizeEntityId(data.lead_id);
      scanSessionId = scanSessionId ?? normalizeEntityId(data.scan_session_id);
      analysisId = analysisId ?? normalizeEntityId(data.analysis_id);
      quoteFileId = quoteFileId ?? normalizeEntityId(data.quote_file_id);

      if (slug) {
        return { slug, leadId, scanSessionId, analysisId, quoteFileId };
      }
    }
  }

  if (leadId) {
    slug = await lookupTableClientSlug(db, "leads", leadId);
    if (slug) {
      return { slug, leadId, scanSessionId, analysisId, quoteFileId };
    }
  }

  if (scanSessionId) {
    slug = await lookupTableClientSlug(db, "scan_sessions", scanSessionId);
    if (slug) {
      return { slug, leadId, scanSessionId, analysisId, quoteFileId };
    }
  }

  if (analysisId) {
    slug = await lookupTableClientSlug(db, "analyses", analysisId);
    if (slug) {
      return { slug, leadId, scanSessionId, analysisId, quoteFileId };
    }
  }

  if (quoteFileId) {
    const { data, error } = await db
      .from("quote_files")
      .select("lead_id")
      .eq("id", quoteFileId)
      .maybeSingle();

    if (!error && data) {
      const quoteLeadId = normalizeEntityId(data.lead_id);
      if (quoteLeadId) {
        slug = await lookupTableClientSlug(db, "leads", quoteLeadId);
        if (slug) {
          return {
            slug,
            leadId: quoteLeadId,
            scanSessionId,
            analysisId,
            quoteFileId,
          };
        }
      }
    }
  }

  return { slug: null, leadId, scanSessionId, analysisId, quoteFileId };
}
