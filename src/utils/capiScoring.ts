import type {
  CapiDiagnosticCode,
  CapiDiagnostics,
  CapiMatchDiagnostics,
  SignalEventRow,
} from "@/services/signalDispatch";

export type DiagnosticCategory = "envelope" | "match" | "dispatch" | "deduplication";
export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface CapiDiagnosticDefinition {
  code: CapiDiagnosticCode;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  evidenceLabel: string;
  likelyCause: string | null;
  recommendedInspection: string;
  confidence: DiagnosticConfidence;
  protectedSystemTrigger: true;
}

export interface MatchFactorLedgerEntry {
  key: keyof Pick<SignalEventRow["matchKeys"], "emailHash" | "phoneHash" | "clientIpPresent" | "clientUserAgentPresent" | "fbp" | "fbc" | "externalId">;
  label: string;
  availablePoints: number;
  earnedPoints: number;
  statusLabel: string;
}

export interface EmqScoreResult {
  score: number | null;
  max: 10;
  scorable: boolean;
  present: string[];
  missing: string[];
  ledger: MatchFactorLedgerEntry[];
}

export interface CapiReasonFrequency {
  code: CapiDiagnosticCode;
  count: number;
  denominator: number;
  percentage: number;
  eventTypes: Array<{ eventType: string; count: number; denominator: number; percentage: number }>;
}

export interface CapiReasonStreak {
  code: CapiDiagnosticCode;
  count: number;
}

export interface CapiRecoveryObservation {
  recovered: boolean;
  healthyRunLength: number;
  previousFailureCodes: CapiDiagnosticCode[];
}

export interface CapiIntelligenceSummary {
  schemaVersion: "wm-capi-diagnostics-v1";
  sampleSize: number;
  actionableIssueCount: number;
  integrityHealthyCount: number;
  unscorableCount: number;
  frequencies: CapiReasonFrequency[];
  currentStreaks: CapiReasonStreak[];
  recovery: CapiRecoveryObservation;
  dominantIssue: CapiDiagnosticCode | null;
  fingerprint: string;
}

export interface RemediationPlaybookEntry {
  code: CapiDiagnosticCode;
  observed: string;
  likelyCause: string;
  confidence: DiagnosticConfidence;
  whyItMatters: string;
  recommendedInspection: string;
  protectedSystemTrigger: true;
  smallestSafeNextSprint: string;
  recommendedRegressionTest: string;
}

const MATCH_FACTORS = [
  { key: "emailHash", label: "Email hash", points: 2, diagnosticKey: "emailHash" },
  { key: "phoneHash", label: "Phone hash", points: 2, diagnosticKey: "phoneHash" },
  { key: "clientIpPresent", label: "Valid client IP", points: 1, diagnosticKey: "clientIp" },
  { key: "clientUserAgentPresent", label: "Client user agent", points: 1, diagnosticKey: "clientUserAgent" },
  { key: "fbp", label: "Valid raw fbp", points: 1, diagnosticKey: "fbp" },
  { key: "fbc", label: "Valid raw fbc", points: 1, diagnosticKey: "fbc" },
  { key: "externalId", label: "External ID hash", points: 2, diagnosticKey: "externalId" },
] as const;

function defineDiagnostic(
  code: CapiDiagnosticCode,
  category: DiagnosticCategory,
  severity: DiagnosticSeverity,
  evidenceLabel: string,
  likelyCause: string | null,
  recommendedInspection: string,
  confidence: DiagnosticConfidence = "HIGH",
): CapiDiagnosticDefinition {
  return { code, category, severity, evidenceLabel, likelyCause, recommendedInspection, confidence, protectedSystemTrigger: true };
}

const INSPECT_ENVELOPE = "Inspect the logged Meta payload assembly and confirm it emits a { data: [...] } envelope without exposing raw values in the browser.";
const INSPECT_HASHING = "Inspect the final server-side Meta payload assembly and its normalization/hash regression tests.";
const INSPECT_COOKIES = "Inspect the final server-side Meta payload assembly and confirm browser identifiers bypass customer-data hashing.";
const INSPECT_CONTEXT = "Inspect the server-side request-context fallback and payload assembly for this field.";
const INSPECT_EVENT = "Inspect the canonical server-side event mapper and the dispatch boundary that created the logged payload.";

export const CAPI_DIAGNOSTIC_DEFINITIONS: Readonly<Record<CapiDiagnosticCode, CapiDiagnosticDefinition>> = {
  CAPI_ENVELOPE_NOT_OBJECT: defineDiagnostic("CAPI_ENVELOPE_NOT_OBJECT", "envelope", "error", "The logged payload is not an object.", "The dispatch logger may have received or stored an unexpected payload shape.", INSPECT_ENVELOPE),
  CAPI_DATA_MISSING: defineDiagnostic("CAPI_DATA_MISSING", "envelope", "error", "The logged payload has no data field.", "The Meta envelope may not have been assembled at the canonical boundary.", INSPECT_ENVELOPE),
  CAPI_DATA_NOT_ARRAY: defineDiagnostic("CAPI_DATA_NOT_ARRAY", "envelope", "error", "The logged payload data field is not an array.", "The Meta envelope may have been flattened or malformed upstream.", INSPECT_ENVELOPE),
  CAPI_DATA_EMPTY: defineDiagnostic("CAPI_DATA_EMPTY", "envelope", "error", "The logged payload data array is empty.", "The event may have been removed before dispatch logging.", INSPECT_ENVELOPE),
  CAPI_EVENT_NOT_OBJECT: defineDiagnostic("CAPI_EVENT_NOT_OBJECT", "envelope", "error", "The first logged data item is not an event object.", "An unexpected value may have entered the event array.", INSPECT_ENVELOPE),
  CAPI_USER_DATA_MISSING: defineDiagnostic("CAPI_USER_DATA_MISSING", "envelope", "error", "The logged event has no user_data field.", "Match data may not have reached final payload assembly.", INSPECT_ENVELOPE),
  CAPI_USER_DATA_NOT_OBJECT: defineDiagnostic("CAPI_USER_DATA_NOT_OBJECT", "envelope", "error", "The logged user_data value is not an object.", "The user-data mapper may have emitted an unexpected structure.", INSPECT_ENVELOPE),
  CAPI_EMAIL_MISSING: defineDiagnostic("CAPI_EMAIL_MISSING", "match", "info", "No email hash was observed.", null, INSPECT_HASHING, "MEDIUM"),
  CAPI_EMAIL_NOT_SHA256: defineDiagnostic("CAPI_EMAIL_NOT_SHA256", "match", "warning", "Email does not have SHA-256 shape.", "Email may be raw, partially transformed, or hashed with the wrong algorithm.", INSPECT_HASHING),
  CAPI_EMAIL_MALFORMED: defineDiagnostic("CAPI_EMAIL_MALFORMED", "match", "warning", "Email match data has an unsupported structure.", "The final user_data mapper may be producing a malformed hashed-value array.", INSPECT_HASHING),
  CAPI_PHONE_MISSING: defineDiagnostic("CAPI_PHONE_MISSING", "match", "info", "No phone hash was observed.", null, INSPECT_HASHING, "MEDIUM"),
  CAPI_PHONE_NOT_SHA256: defineDiagnostic("CAPI_PHONE_NOT_SHA256", "match", "warning", "Phone does not have SHA-256 shape.", "Phone may be raw, incompletely normalized, or hashed with the wrong algorithm.", INSPECT_HASHING),
  CAPI_PHONE_MALFORMED: defineDiagnostic("CAPI_PHONE_MALFORMED", "match", "warning", "Phone match data has an unsupported structure.", "The final user_data mapper may be producing a malformed hashed-value array.", INSPECT_HASHING),
  CAPI_CLIENT_IP_MISSING: defineDiagnostic("CAPI_CLIENT_IP_MISSING", "match", "info", "No client IP was observed.", null, INSPECT_CONTEXT, "MEDIUM"),
  CAPI_CLIENT_IP_FALLBACK: defineDiagnostic("CAPI_CLIENT_IP_FALLBACK", "match", "warning", "Client IP contains the unusable 0.0.0.0 fallback.", "The request header chain may not have supplied a usable client address.", INSPECT_CONTEXT),
  CAPI_CLIENT_IP_MALFORMED: defineDiagnostic("CAPI_CLIENT_IP_MALFORMED", "match", "warning", "Client IP is not a string value.", "An unexpected value may have reached request-context mapping.", INSPECT_CONTEXT),
  CAPI_CLIENT_UA_MISSING: defineDiagnostic("CAPI_CLIENT_UA_MISSING", "match", "info", "No client user agent was observed.", null, INSPECT_CONTEXT, "MEDIUM"),
  CAPI_CLIENT_UA_MALFORMED: defineDiagnostic("CAPI_CLIENT_UA_MALFORMED", "match", "warning", "Client user agent is not a string value.", "An unexpected value may have reached request-context mapping.", INSPECT_CONTEXT),
  CAPI_FBP_MISSING: defineDiagnostic("CAPI_FBP_MISSING", "match", "info", "No fbp browser identifier was observed.", null, INSPECT_COOKIES, "MEDIUM"),
  CAPI_FBP_HASHED: defineDiagnostic("CAPI_FBP_HASHED", "match", "warning", "fbp has the shape of a SHA-256 digest.", "A shared customer-data hashing step may be processing fbp.", INSPECT_COOKIES),
  CAPI_FBP_MALFORMED: defineDiagnostic("CAPI_FBP_MALFORMED", "match", "warning", "fbp does not have the expected raw cookie shape.", "The browser identifier may have been truncated or transformed.", INSPECT_COOKIES),
  CAPI_FBC_MISSING: defineDiagnostic("CAPI_FBC_MISSING", "match", "info", "No fbc click identifier was observed.", null, "Confirm whether the originating visit had a Meta click identifier before treating this absence as a defect.", "LOW"),
  CAPI_FBC_HASHED: defineDiagnostic("CAPI_FBC_HASHED", "match", "warning", "fbc has the shape of a SHA-256 digest.", "A shared customer-data hashing step may be processing fbc.", INSPECT_COOKIES),
  CAPI_FBC_MALFORMED: defineDiagnostic("CAPI_FBC_MALFORMED", "match", "warning", "fbc does not have the expected raw cookie shape.", "The click identifier may have been constructed or transformed incorrectly.", INSPECT_COOKIES),
  CAPI_EXTERNAL_ID_MISSING: defineDiagnostic("CAPI_EXTERNAL_ID_MISSING", "match", "info", "No external ID hash was observed.", null, INSPECT_HASHING, "MEDIUM"),
  CAPI_EXTERNAL_ID_NOT_SHA256: defineDiagnostic("CAPI_EXTERNAL_ID_NOT_SHA256", "match", "warning", "External ID does not have SHA-256 shape.", "External ID may have bypassed the canonical hashing step.", INSPECT_HASHING),
  CAPI_EXTERNAL_ID_MALFORMED: defineDiagnostic("CAPI_EXTERNAL_ID_MALFORMED", "match", "warning", "External ID has an unsupported structure.", "The external-ID mapper may be emitting an unexpected container type.", INSPECT_HASHING),
  CAPI_TIME_MISSING: defineDiagnostic("CAPI_TIME_MISSING", "dispatch", "error", "event_time is missing.", "The canonical event timestamp may not have reached payload assembly.", INSPECT_EVENT),
  CAPI_TIME_WRONG_TYPE: defineDiagnostic("CAPI_TIME_WRONG_TYPE", "dispatch", "error", "event_time is not a finite number.", "The timestamp may have been serialized as text or corrupted upstream.", INSPECT_EVENT),
  CAPI_TIME_UNSAFE_INTEGER: defineDiagnostic("CAPI_TIME_UNSAFE_INTEGER", "dispatch", "error", "event_time is not a safe integer.", "The timestamp may contain fractional or precision-unsafe data.", INSPECT_EVENT),
  CAPI_TIME_WRONG_UNIT: defineDiagnostic("CAPI_TIME_WRONG_UNIT", "dispatch", "error", "event_time appears to use milliseconds instead of Unix seconds.", "A Date.now() value may have bypassed conversion to seconds.", INSPECT_EVENT),
  CAPI_TIME_OUT_OF_RANGE: defineDiagnostic("CAPI_TIME_OUT_OF_RANGE", "dispatch", "error", "event_time is outside the supported Unix-seconds range.", "The timestamp may use an unsupported unit or invalid source value.", INSPECT_EVENT),
  CAPI_TIME_REFERENCE_UNAVAILABLE: defineDiagnostic("CAPI_TIME_REFERENCE_UNAVAILABLE", "dispatch", "warning", "Timestamp drift could not be evaluated because fired_at is invalid.", "The log-row dispatch timestamp may be malformed or unavailable.", "Inspect the read-only log timestamp source before drawing a drift conclusion.", "MEDIUM"),
  CAPI_TIME_STALE: defineDiagnostic("CAPI_TIME_STALE", "dispatch", "error", "event_time is more than seven days before dispatch.", "A delayed queue or reused historical event timestamp may be involved.", INSPECT_EVENT),
  CAPI_TIME_FUTURE: defineDiagnostic("CAPI_TIME_FUTURE", "dispatch", "error", "event_time is later than the logged dispatch time.", "Clock skew or incorrect timestamp construction may be involved.", INSPECT_EVENT),
  CAPI_EVENT_ID_MISSING: defineDiagnostic("CAPI_EVENT_ID_MISSING", "deduplication", "warning", "event_id is missing.", "The server/browser deduplication identifier may not have reached final payload assembly.", INSPECT_EVENT),
  CAPI_EVENT_ID_WRONG_TYPE: defineDiagnostic("CAPI_EVENT_ID_WRONG_TYPE", "deduplication", "warning", "event_id is not a non-empty string.", "The event identity contract may have been transformed unexpectedly.", INSPECT_EVENT),
  CAPI_EVENT_NAME_MISSING: defineDiagnostic("CAPI_EVENT_NAME_MISSING", "dispatch", "error", "event_name is missing.", "The canonical event mapper may not have supplied an event name.", INSPECT_EVENT),
  CAPI_EVENT_NAME_WRONG_TYPE: defineDiagnostic("CAPI_EVENT_NAME_WRONG_TYPE", "dispatch", "error", "event_name is not a non-empty string.", "The event name may have been transformed into an unsupported type.", INSPECT_EVENT),
  CAPI_EVENT_NAME_LOG_MISMATCH: defineDiagnostic("CAPI_EVENT_NAME_LOG_MISMATCH", "dispatch", "warning", "Payload event_name differs from the log row event_name.", "The logged summary and final payload may have been produced from different values.", INSPECT_EVENT),
  CAPI_ACTION_SOURCE_MISSING: defineDiagnostic("CAPI_ACTION_SOURCE_MISSING", "dispatch", "error", "action_source is missing.", "The WindowMan Meta mapper may not have supplied its canonical action source.", INSPECT_EVENT),
  CAPI_ACTION_SOURCE_WRONG_TYPE: defineDiagnostic("CAPI_ACTION_SOURCE_WRONG_TYPE", "dispatch", "error", "action_source is not a non-empty string.", "The action source may have been transformed into an unsupported type.", INSPECT_EVENT),
  CAPI_ACTION_SOURCE_UNEXPECTED: defineDiagnostic("CAPI_ACTION_SOURCE_UNEXPECTED", "dispatch", "warning", "action_source is unexpected for WindowMan's website lane.", "A different lane or mapper may have produced this payload.", INSPECT_EVENT, "MEDIUM"),
};

function factorStatusLabel(
  factor: typeof MATCH_FACTORS[number],
  diagnostics: CapiMatchDiagnostics | null | undefined,
  present: boolean,
): string {
  const status = diagnostics?.[factor.diagnosticKey];
  if (status === "valid") return factor.key === "fbp" || factor.key === "fbc" ? "Valid raw identifier" : "Valid";
  if (status === "not_sha256") return "Not SHA-256";
  if (status === "hashed") return "Hashed incorrectly";
  if (status === "malformed") return "Malformed";
  if (status === "fallback") return "Fallback 0.0.0.0 is unusable";
  if (status === "unavailable") return "Unable to inspect";
  if (status === "missing") return factor.key === "fbc" ? "Not present (informational)" : "Not present";
  return present ? "Available" : "Not available";
}

export function calculateEmqScore(
  matchKeys: SignalEventRow["matchKeys"] | null | undefined,
  diagnostics?: CapiDiagnostics | null,
): EmqScoreResult {
  const scorable = diagnostics?.scorable ?? Boolean(matchKeys);
  const present: string[] = [];
  const missing: string[] = [];
  let score = 0;

  const ledger = MATCH_FACTORS.map((factor): MatchFactorLedgerEntry => {
    const factorPresent = scorable && matchKeys?.[factor.key] === true;
    if (factorPresent) {
      score += factor.points;
      present.push(factor.label);
    } else {
      missing.push(factor.label);
    }
    return {
      key: factor.key,
      label: factor.label,
      availablePoints: factor.points,
      earnedPoints: factorPresent ? factor.points : 0,
      statusLabel: scorable ? factorStatusLabel(factor, diagnostics?.match, factorPresent) : "Unable to inspect",
    };
  });

  return { score: scorable ? score : null, max: 10, scorable, present, missing, ledger };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRealCapiRow(value: unknown): value is SignalEventRow {
  return isObject(value)
    && value.sourceTable === "capi_signal_logs"
    && typeof value.id === "string"
    && value.id.trim().length > 0;
}

function timestampValue(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function selectCapiRows(events: readonly SignalEventRow[] | null | undefined): SignalEventRow[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter(isRealCapiRow)
    .map((row, index) => ({ row, index, timestamp: timestampValue(row.timestamp) }))
    .sort((left, right) => {
      if (left.timestamp === null && right.timestamp === null) return left.index - right.index;
      if (left.timestamp === null) return 1;
      if (right.timestamp === null) return -1;
      return right.timestamp - left.timestamp || left.index - right.index;
    })
    .map(({ row }) => row);
}

function validReasonCodes(row: SignalEventRow): CapiDiagnosticCode[] {
  const values = row.capiDiagnostics?.reasonCodes;
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((code): code is CapiDiagnosticCode => typeof code === "string" && code in CAPI_DIAGNOSTIC_DEFINITIONS))];
}

function isActionable(code: CapiDiagnosticCode): boolean {
  return CAPI_DIAGNOSTIC_DEFINITIONS[code].severity !== "info";
}

function reasonPercentage(count: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((count / denominator) * 1_000) / 10;
}

export function aggregateCapiIntelligence(events: readonly SignalEventRow[] | null | undefined): CapiIntelligenceSummary {
  const rows = selectCapiRows(events);
  const counts = new Map<CapiDiagnosticCode, number>();
  const eventTypeCounts = new Map<CapiDiagnosticCode, Map<string, number>>();
  const eventTypeDenominators = new Map<string, number>();
  const rowCodes: CapiDiagnosticCode[][] = [];
  let actionableIssueCount = 0;
  let integrityHealthyCount = 0;
  let unscorableCount = 0;

  for (const row of rows) {
    const eventType = typeof row.eventType === "string" && row.eventType.trim() ? row.eventType : "Unknown event";
    eventTypeDenominators.set(eventType, (eventTypeDenominators.get(eventType) ?? 0) + 1);
    const codes = validReasonCodes(row);
    rowCodes.push(codes);
    const actionable = codes.filter(isActionable);
    if (actionable.length > 0) actionableIssueCount += 1;
    if (row.capiDiagnostics?.scorable === false) unscorableCount += 1;
    if (row.capiDiagnostics && actionable.length === 0) integrityHealthyCount += 1;

    for (const code of codes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
      const byType = eventTypeCounts.get(code) ?? new Map<string, number>();
      byType.set(eventType, (byType.get(eventType) ?? 0) + 1);
      eventTypeCounts.set(code, byType);
    }
  }

  const frequencies = [...counts.entries()]
    .map(([code, count]): CapiReasonFrequency => ({
      code,
      count,
      denominator: rows.length,
      percentage: reasonPercentage(count, rows.length),
      eventTypes: [...(eventTypeCounts.get(code) ?? new Map()).entries()]
        .map(([eventType, eventCount]) => ({
          eventType,
          count: eventCount,
          denominator: eventTypeDenominators.get(eventType) ?? 0,
          percentage: reasonPercentage(eventCount, eventTypeDenominators.get(eventType) ?? 0),
        }))
        .sort((a, b) => b.count - a.count || a.eventType.localeCompare(b.eventType)),
    }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  const currentStreaks = (rowCodes[0] ?? [])
    .filter(isActionable)
    .map((code): CapiReasonStreak => {
      let count = 0;
      for (const codes of rowCodes) {
        if (!codes.includes(code)) break;
        count += 1;
      }
      return { code, count };
    })
    .filter((streak) => streak.count > 0)
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  let healthyRunLength = 0;
  for (let index = 0; index < rows.length; index += 1) {
    if (!rows[index].capiDiagnostics || rowCodes[index].some(isActionable)) break;
    healthyRunLength += 1;
  }
  const previousFailureCodes = healthyRunLength < rowCodes.length
    ? rowCodes[healthyRunLength].filter(isActionable).sort()
    : [];
  const recovery = {
    recovered: healthyRunLength >= 5 && previousFailureCodes.length > 0,
    healthyRunLength,
    previousFailureCodes,
  };

  const severityRank: Record<DiagnosticSeverity, number> = { error: 2, warning: 1, info: 0 };
  const dominantIssue = frequencies
    .filter((frequency) => isActionable(frequency.code))
    .sort((a, b) => b.count - a.count
      || severityRank[CAPI_DIAGNOSTIC_DEFINITIONS[b.code].severity] - severityRank[CAPI_DIAGNOSTIC_DEFINITIONS[a.code].severity]
      || a.code.localeCompare(b.code))[0]?.code ?? null;

  const fingerprintParts = frequencies
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((frequency) => `${frequency.code}=${frequency.count}`);

  return {
    schemaVersion: "wm-capi-diagnostics-v1",
    sampleSize: rows.length,
    actionableIssueCount,
    integrityHealthyCount,
    unscorableCount,
    frequencies,
    currentStreaks,
    recovery,
    dominantIssue,
    fingerprint: [`N=${rows.length}`, ...fingerprintParts].join("|"),
  };
}

function whyItMatters(code: CapiDiagnosticCode): string {
  const definition = CAPI_DIAGNOSTIC_DEFINITIONS[code];
  if (definition.category === "envelope") return "The event cannot be inspected or reliably scored from the logged structure.";
  if (definition.category === "deduplication") return "Browser/server deduplication may be less reliable, even though this alone does not prove rejection.";
  if (definition.category === "dispatch") return "The logged payload may not satisfy WindowMan's expected Meta dispatch contract.";
  return "This condition can reduce identifier readiness or indicate an incorrect match-data transformation.";
}

function regressionTestFor(code: CapiDiagnosticCode): string {
  if (code === "CAPI_FBP_HASHED" || code === "CAPI_FBC_HASHED") return "Assert the supplied browser identifier remains byte-identical through final server payload assembly.";
  if (code === "CAPI_TIME_WRONG_UNIT") return "Assert final event_time is an integer Unix-seconds value and rejects Date.now()-style milliseconds.";
  if (code.startsWith("CAPI_EVENT_ID_")) return "Assert the server-issued event ID reaches the final Meta payload unchanged as a non-empty string.";
  if (code.startsWith("CAPI_ACTION_SOURCE_")) return "Assert the WindowMan Meta mapper emits action_source website for this lane.";
  return `Add a focused canonical-mapper regression that prevents ${code} while preserving existing routing and identifier privacy.`;
}

const SMALLEST_SAFE_SPRINT = "Read-only trace first. If confirmed, open a separately approved Tier C measurement sprint naming the exact server mapper and regression tests.";

function createRemediationEntry(code: CapiDiagnosticCode): RemediationPlaybookEntry {
  const definition = CAPI_DIAGNOSTIC_DEFINITIONS[code];
  return {
    code,
    observed: definition.evidenceLabel,
    likelyCause: definition.likelyCause ?? "NEEDS REPO VERIFICATION",
    confidence: definition.confidence,
    whyItMatters: whyItMatters(code),
    recommendedInspection: definition.recommendedInspection,
    protectedSystemTrigger: true,
    smallestSafeNextSprint: SMALLEST_SAFE_SPRINT,
    recommendedRegressionTest: regressionTestFor(code),
  };
}

export const CAPI_REMEDIATION_PLAYBOOK: Readonly<Partial<Record<CapiDiagnosticCode, RemediationPlaybookEntry>>> = Object.freeze(
  Object.fromEntries(
    (Object.keys(CAPI_DIAGNOSTIC_DEFINITIONS) as CapiDiagnosticCode[])
      .filter((code) => CAPI_DIAGNOSTIC_DEFINITIONS[code].severity !== "info")
      .map((code) => [code, createRemediationEntry(code)]),
  ),
);

export function getRemediationPlaybook(code: CapiDiagnosticCode): RemediationPlaybookEntry | null {
  return CAPI_REMEDIATION_PLAYBOOK[code] ?? null;
}

export function buildHumanGatedRecommendation(summary: CapiIntelligenceSummary): string {
  const code = summary.dominantIssue;
  if (!code) {
    return [
      "TYPE: NEEDS INVESTIGATION",
      "TITLE: No actionable CAPI integrity pattern in the current fetched sample",
      `OBSERVED EVIDENCE: ${summary.sampleSize} sanitized CAPI rows analyzed; no error or warning code is dominant.`,
      `SAMPLE / COVERAGE: Current fetched sample only, N=${summary.sampleSize}.`,
      "CONFIDENCE: MEDIUM",
      "WHY IT MATTERS: Absence of a current actionable pattern does not prove production completeness or Meta attribution.",
      "RECOMMENDATION: Continue human review using canonical operator evidence.",
      "AFFECTED SYSTEMS: Measurement diagnostics",
      "PROTECTED SYSTEM TRIGGER: YES",
      "SMALLEST SAFE SPRINT: NEEDS MORE DATA",
      "VERIFICATION: Compare future sanitized reason frequencies with this sample; recommendation grants no implementation authority.",
    ].join("\n");
  }

  const frequency = summary.frequencies.find((item) => item.code === code)!;
  const playbook = getRemediationPlaybook(code)!;
  return [
    "TYPE: DATA_QUALITY",
    `TITLE: Investigate repeated ${code} findings`,
    `OBSERVED EVIDENCE: ${frequency.count} of ${frequency.denominator} rows (${frequency.percentage}%) contain ${code}.`,
    `SAMPLE / COVERAGE: Current fetched CAPI sample only, N=${summary.sampleSize}; not all historical events.`,
    `CONFIDENCE: ${playbook.confidence} for the observed shape; upstream cause is INFERRED.`,
    `WHY IT MATTERS: ${playbook.whyItMatters}`,
    `RECOMMENDATION: ${playbook.recommendedInspection}`,
    "AFFECTED SYSTEMS: Meta CAPI measurement diagnostics and the separately reviewed canonical server lane",
    "PROTECTED SYSTEM TRIGGER: YES",
    `SMALLEST SAFE SPRINT: ${playbook.smallestSafeNextSprint}`,
    `VERIFICATION: ${playbook.recommendedRegressionTest} This recommendation grants no implementation authority.`,
  ].join("\n");
}

export function buildCopySafeDiagnostic(summary: CapiIntelligenceSummary): string {
  return JSON.stringify({
    schemaVersion: summary.schemaVersion,
    sampleSize: summary.sampleSize,
    reasonFrequencies: summary.frequencies.map(({ code, count, percentage }) => ({ code, count, percentage })),
    currentStreaks: summary.currentStreaks,
    recovery: {
      recovered: summary.recovery.recovered,
      healthyRunLength: summary.recovery.healthyRunLength,
      previousFailureCodes: summary.recovery.previousFailureCodes,
    },
    dominantIssue: summary.dominantIssue,
    confidence: summary.dominantIssue ? CAPI_DIAGNOSTIC_DEFINITIONS[summary.dominantIssue].confidence : "MEDIUM",
    protectedSystemTrigger: true,
  }, null, 2);
}

export function platformOutcomeLabel(httpStatus: number | null | undefined): string {
  if (typeof httpStatus !== "number" || !Number.isFinite(httpStatus)) return "No HTTP outcome recorded";
  if (httpStatus >= 200 && httpStatus < 300) return "Meta request accepted at HTTP layer";
  if (httpStatus >= 400 && httpStatus < 500) return "Meta request rejected at HTTP layer";
  if (httpStatus >= 500 && httpStatus < 600) return "Server/platform failure or retryable outcome";
  return "HTTP outcome recorded outside the expected response ranges";
}
