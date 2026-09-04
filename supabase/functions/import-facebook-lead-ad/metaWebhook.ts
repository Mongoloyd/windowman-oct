export type JsonRecord = Record<string, unknown>;

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type MetaLeadgenEvent = {
  leadgenId: string;
  pageId: string | null;
  formId: string | null;
  adId: string | null;
  createdTime: string | null;
};

export type MetaGraphLeadResult =
  | { ok: true; lead: JsonRecord }
  | {
    ok: false;
    error:
      | "meta_graph_invalid_config"
      | "meta_graph_unavailable"
      | "meta_graph_rejected"
      | "meta_graph_invalid_response";
    upstreamStatus: number | null;
  };

const GRAPH_LEAD_FIELDS = [
  "id",
  "created_time",
  "ad_id",
  "form_id",
  "field_data",
].join(",");

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function cleanIdentifier(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 255);
}

function toIsoTimestamp(milliseconds: number): string | null {
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizeMetaCreatedTime(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    return toIsoTimestamp(milliseconds);
  }

  const cleaned = cleanIdentifier(value);
  if (!cleaned) return null;
  if (/^\d{10,13}$/.test(cleaned)) {
    const numeric = Number(cleaned);
    const milliseconds = cleaned.length === 13 ? numeric : numeric * 1000;
    return toIsoTimestamp(milliseconds);
  }
  return cleaned;
}

function constantTimeEqualText(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function resolveMetaVerification(
  url: URL,
  expectedToken: string | undefined,
):
  | { ok: true; challenge: string }
  | { ok: false; error: "not_configured" | "verification_failed" } {
  if (!expectedToken) return { ok: false, error: "not_configured" };

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode !== "subscribe" || token === null || challenge === null ||
    challenge.length === 0 || challenge.length > 1024 ||
    !constantTimeEqualText(token, expectedToken)
  ) {
    return { ok: false, error: "verification_failed" };
  }

  return { ok: true, challenge };
}

export async function verifyMetaWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;
  const match = /^sha256=([a-fA-F0-9]{64})$/.exec(signatureHeader.trim());
  if (!match) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new Uint8Array(rawBody).buffer,
    ),
  );
  const expectedHex = bytesToHex(digest);

  return constantTimeEqualText(expectedHex, match[1].toLowerCase());
}

export function extractMetaLeadgenEvents(
  payload: JsonRecord,
): MetaLeadgenEvent[] {
  if (payload.object !== "page" || !Array.isArray(payload.entry)) return [];

  const events: MetaLeadgenEvent[] = [];
  const seenLeadgenIds = new Set<string>();

  for (const rawEntry of payload.entry) {
    const entry = asRecord(rawEntry);
    if (!entry || !Array.isArray(entry.changes)) continue;
    const entryPageId = cleanIdentifier(entry.id);

    for (const rawChange of entry.changes) {
      const change = asRecord(rawChange);
      if (!change || change.field !== "leadgen") continue;
      const value = asRecord(change.value);
      if (!value) continue;

      const leadgenId = cleanIdentifier(value.leadgen_id);
      if (!leadgenId || seenLeadgenIds.has(leadgenId)) continue;
      seenLeadgenIds.add(leadgenId);

      events.push({
        leadgenId,
        pageId: cleanIdentifier(value.page_id) ?? entryPageId,
        formId: cleanIdentifier(value.form_id),
        adId: cleanIdentifier(value.ad_id),
        createdTime: normalizeMetaCreatedTime(value.created_time),
      });
    }
  }

  return events;
}

export function isMetaWebhookTestMode(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== "false";
}

export async function fetchMetaGraphLead(
  leadgenId: string,
  options: {
    accessToken: string;
    apiVersion: string;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  },
): Promise<MetaGraphLeadResult> {
  const apiVersion = options.apiVersion.trim();
  const accessToken = options.accessToken.trim();
  if (!/^v\d{1,3}\.\d{1,2}$/.test(apiVersion) || !accessToken) {
    return {
      ok: false,
      error: "meta_graph_invalid_config",
      upstreamStatus: null,
    };
  }

  const url = new URL(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(leadgenId)}`,
  );
  url.searchParams.set("fields", GRAPH_LEAD_FIELDS);

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 10_000,
  );

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
  } catch (_error) {
    return {
      ok: false,
      error: "meta_graph_unavailable",
      upstreamStatus: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return {
      ok: false,
      error: "meta_graph_rejected",
      upstreamStatus: response.status,
    };
  }

  let rawLead: unknown;
  try {
    rawLead = await response.json();
  } catch (_error) {
    return {
      ok: false,
      error: "meta_graph_invalid_response",
      upstreamStatus: response.status,
    };
  }

  const lead = asRecord(rawLead);
  if (!lead || !cleanIdentifier(lead.id) || !Array.isArray(lead.field_data)) {
    return {
      ok: false,
      error: "meta_graph_invalid_response",
      upstreamStatus: response.status,
    };
  }

  return { ok: true, lead };
}

export function buildTrustedImportPayload(
  lead: JsonRecord,
  event: MetaLeadgenEvent,
  testMode: boolean,
): JsonRecord {
  return {
    ...lead,
    platform_lead_id: event.leadgenId,
    leadgen_id: event.leadgenId,
    form_id: lead.form_id ?? event.formId,
    ad_id: lead.ad_id ?? event.adId,
    created_time: lead.created_time ?? event.createdTime,
    raw_payload: {
      ...lead,
      meta_webhook_context: {
        leadgen_id: event.leadgenId,
        page_id: event.pageId,
        form_id: event.formId,
        ad_id: event.adId,
        created_time: event.createdTime,
        test_mode: testMode,
      },
    },
  };
}
