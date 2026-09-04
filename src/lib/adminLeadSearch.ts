export type AdminLeadSearchRecord = {
  id: string;
  session_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  county?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  source?: string | null;
  client_slug?: string | null;
  funnel_stage?: string | null;
};

function normalizeSearchText(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKD").trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

function digitsOnly(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

/**
 * Shared operator search semantics for every in-memory lead projection.
 * Matches all text tokens plus phone-number digits, so formatted and E.164
 * numbers behave the same. Full and partial lead/session UUIDs are searchable.
 */
export function matchesAdminLeadSearch(
  lead: AdminLeadSearchRecord,
  query: string,
  extraValues: readonly unknown[] = [],
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
  const values = [
    name,
    lead.first_name,
    lead.last_name,
    lead.email,
    lead.phone_e164,
    lead.county,
    lead.city,
    lead.state,
    lead.zip,
    lead.id,
    lead.session_id,
    lead.source,
    lead.client_slug,
    lead.funnel_stage,
    ...extraValues,
  ];
  const searchableText = values.map(normalizeSearchText).filter(Boolean).join(" ");
  const textMatches = normalizedQuery
    .split(" ")
    .every((token) => searchableText.includes(token));
  if (textMatches) return true;

  const queryDigits = digitsOnly(query);
  if (queryDigits.length < 3) return false;

  return [lead.phone_e164, lead.zip]
    .map(digitsOnly)
    .some((value) => value.includes(queryDigits));
}
