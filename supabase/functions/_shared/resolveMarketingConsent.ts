/**
 * Server-side marketing-consent resolution for diagnosis callback Meta gating.
 *
 * Authority is the latest persisted lead_consent_events row for
 * purpose = marketing_communications. Browser flags are never trusted.
 */

export const MARKETING_CONSENT_PURPOSE = "marketing_communications" as const;

export type MarketingConsentState = "granted" | "denied" | "unknown";

export type MarketingConsentResolution = {
  state: MarketingConsentState;
  suppressionReason:
    | "consent_declined"
    | "consent_withdrawn"
    | "consent_missing"
    | "consent_lookup_failed"
    | null;
};

export interface ConsentEventRow {
  decision: string | null;
  created_at: string | null;
  id?: string | null;
}

export interface MarketingConsentFetcher {
  listMarketingDecisions(leadId: string): Promise<ConsentEventRow[]>;
}

export function resolveMarketingConsentFromRows(
  rows: ConsentEventRow[],
): MarketingConsentResolution {
  if (rows.length === 0) {
    return { state: "unknown", suppressionReason: "consent_missing" };
  }

  const latest = rows[0];
  const decision = typeof latest.decision === "string"
    ? latest.decision.trim().toLowerCase()
    : "";

  if (decision === "granted") {
    return { state: "granted", suppressionReason: null };
  }
  if (decision === "declined") {
    return { state: "denied", suppressionReason: "consent_declined" };
  }
  if (decision === "withdrawn") {
    return { state: "denied", suppressionReason: "consent_withdrawn" };
  }
  return { state: "unknown", suppressionReason: "consent_missing" };
}

export async function resolveMarketingConsent(
  fetcher: MarketingConsentFetcher,
  leadId: string,
): Promise<MarketingConsentResolution> {
  try {
    const rows = await fetcher.listMarketingDecisions(leadId);
    return resolveMarketingConsentFromRows(rows);
  } catch (error) {
    console.error("[resolveMarketingConsent] lookup failed:", error);
    return { state: "unknown", suppressionReason: "consent_lookup_failed" };
  }
}

type SupabaseLike = {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        eq(
          column: string,
          value: string,
        ): {
          order(
            column: string,
            options: { ascending: boolean },
          ): {
            order(
              column: string,
              options: { ascending: boolean },
            ): Promise<{
              data: ConsentEventRow[] | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    };
  };
};

export function createSupabaseMarketingConsentFetcher(
  supabase: SupabaseLike,
): MarketingConsentFetcher {
  return {
    async listMarketingDecisions(leadId) {
      const { data, error } = await supabase
        .from("lead_consent_events")
        .select("id, decision, created_at")
        .eq("lead_id", leadId)
        .eq("purpose", MARKETING_CONSENT_PURPOSE)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },
  };
}
