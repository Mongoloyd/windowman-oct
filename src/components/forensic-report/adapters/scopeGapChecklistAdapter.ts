/**
 * scopeGapChecklistAdapter — partial lab-only mapper for Install-Day Coverage Map.
 * Maps a limited set of extraction fields to ScopeGapChecklistProps. No fetch, no hooks.
 */
import type {
  ScopeGapChecklistProps,
  ScopeGapItem,
  ScopeGapPhase,
  ScopeGapState,
  ScopeGapSummaryCounts,
} from "../ScopeGapChecklist.types";
import type { V2FullReportSource } from "./reportAccessAdapter.types";
import {
  asBooleanOrNull,
  asString,
  asTrimmedStringField,
  getRecord,
} from "./reportAccessAdapter.helpers";

type TextScopeSignal = "included" | "excluded" | "unclear" | null;

interface ExtractionSlice {
  debris_removal_included: boolean | null;
  rot_unit_pricing_present: boolean | null;
  substrate_allowance_text: string | null;
  substrate_condition_clause_present: boolean | null;
  waterproofing_method_text: string | null;
  sealant_specified: boolean | null;
  stucco_repair_included: boolean | null;
  post_install_stucco_excluded: boolean | null;
  wall_repair_scope: string | null;
  permit_fees_itemized: boolean | null;
  permits_included: boolean | null;
  permits_responsible_party: string | null;
  permits_details: string | null;
  installation_scope_detail: string | null;
  installation_disposal_included: boolean | null;
}

const EXCLUSION_PHRASES = [
  "not included",
  "excluded",
  "excludes",
  "owner responsible",
  "homeowner responsible",
  "customer responsible",
  "by others",
  "billed separately",
  "additional charge",
  "separate charge",
  "not part of the contract",
  "not part of scope",
  "outside the scope",
  "at owner's expense",
  "at customer expense",
  "not in base price",
] as const;

const NEGATED_EXCLUSION_PHRASES = [
  "do not exclude",
  "does not exclude",
  "not excluded",
  "no exclusions",
  "nothing excluded",
  "without excluding",
  "will not be excluded",
] as const;

const INCLUSION_PHRASES = [
  "included in scope",
  "included in contract",
  "included in contract price",
  "included in base price",
  "price includes",
  "scope includes",
  "contractor to provide",
  "contractor will provide",
  "contractor to perform",
  "provided by contractor",
] as const;

const VAGUE_PHRASES = [
  "as needed",
  "if needed",
  "if required",
  "subject to",
  "field conditions",
  "to be determined",
  "tbd",
  "may apply",
  "additional work may be required",
  "where necessary",
  "if applicable",
  "upon inspection",
  "after inspection",
  "depending on condition",
  "hidden conditions",
] as const;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  const normalized = normalizeText(text);
  const needle = phrase.toLowerCase();
  if (needle === "included") {
    return (
      INCLUSION_PHRASES.some((p) => normalized.includes(p)) ||
      (normalized.includes("included") && !normalized.includes("not included"))
    );
  }
  return normalized.includes(needle);
}

function classifyScopeText(text: string | null): TextScopeSignal {
  if (!text) return null;

  const normalized = normalizeText(text);
  if (normalized.length === 0) return null;

  const hasNegatedExclusion = NEGATED_EXCLUSION_PHRASES.some((p) =>
    normalized.includes(p),
  );
  const hasExclusion =
    !hasNegatedExclusion &&
    EXCLUSION_PHRASES.some((p) => containsPhrase(normalized, p));
  const hasInclusion = INCLUSION_PHRASES.some((p) => normalized.includes(p)) ||
    (normalized.includes("included") && !normalized.includes("not included"));
  const hasVague = VAGUE_PHRASES.some((p) => normalized.includes(p));

  if (hasInclusion && hasExclusion) return "unclear";
  if (hasInclusion && hasNegatedExclusion) return hasVague ? "unclear" : "included";
  if (hasExclusion && hasNegatedExclusion) return "unclear";
  if (hasInclusion && hasVague) return "unclear";
  if (hasExclusion && hasVague) return "unclear";
  if (hasExclusion) return "excluded";
  if (hasInclusion) return "included";
  if (hasVague || hasNegatedExclusion) return "unclear";

  return null;
}

function mergeSignals(
  ...signals: Array<TextScopeSignal | ScopeGapState | null>
): ScopeGapState {
  const filtered = signals.filter((s): s is TextScopeSignal | ScopeGapState => s !== null);
  if (filtered.length === 0) return "not_detected";

  if (filtered.includes("unclear")) return "unclear";
  if (filtered.includes("excluded") && filtered.includes("included")) return "unclear";
  if (filtered.includes("excluded")) return "excluded";
  if (filtered.includes("included")) return "included";

  return "not_detected";
}

function booleanInclusionSignal(value: boolean | null): TextScopeSignal {
  if (value === true) return "included";
  return null;
}

function booleanExclusionSignal(value: boolean | null): TextScopeSignal {
  if (value === true) return "excluded";
  return null;
}

function pickEvidence(...values: Array<string | null>): string | null {
  for (const value of values) {
    const text = asString(value);
    if (text !== null) return text;
  }
  return null;
}

function computeSummary(phases: ScopeGapPhase[]): ScopeGapSummaryCounts {
  const items = phases.flatMap((phase) => phase.items);
  const included = items.filter((item) => item.state === "included").length;
  const unclear = items.filter((item) => item.state === "unclear").length;
  const notDetected = items.filter((item) => item.state === "not_detected").length;
  const excluded = items.filter((item) => item.state === "excluded").length;
  const notApplicable = items.filter((item) => item.state === "not_applicable").length;
  return {
    included,
    unclear,
    notDetected,
    excluded,
    notApplicable,
    needsConfirmation: unclear + notDetected + excluded,
  };
}

function buildDebrisItem(ext: ExtractionSlice): ScopeGapItem {
  const textBlob = [ext.installation_scope_detail].filter(Boolean).join(" ");
  const textSignal = classifyScopeText(textBlob.length > 0 ? textBlob : null);
  const state = mergeSignals(
    booleanInclusionSignal(ext.debris_removal_included),
    booleanInclusionSignal(ext.installation_disposal_included),
    textSignal,
  );

  const evidenceText = pickEvidence(ext.installation_scope_detail);

  if (state === "included") {
    return {
      fieldKey: "debris_removal_included",
      label: "Debris Removal & Hauling",
      state,
      statusLabel: "Included in writing",
      evidenceText,
      homeownerRiskCopy:
        "Debris cleanup and haul-away appear inside the parsed contract scope.",
      contractorQuestion:
        "Please confirm jobsite debris hauling and cleanup are included with no additional disposal fee.",
    };
  }

  if (state === "excluded") {
    return {
      fieldKey: "debris_removal_included",
      label: "Debris Removal & Hauling",
      state,
      statusLabel: "Explicitly excluded / owner responsibility",
      evidenceText,
      homeownerRiskCopy:
        "The parsed quote appears to place trash disposal or cleanup outside included contractor scope.",
      contractorQuestion:
        "Since debris removal appears excluded, can you provide a written add-on price for haul-away?",
    };
  }

  if (state === "unclear") {
    return {
      fieldKey: "debris_removal_included",
      label: "Debris Removal & Hauling",
      state,
      statusLabel: "Needs written confirmation",
      evidenceText,
      homeownerRiskCopy:
        "Debris or cleanup is mentioned, but the responsibility or disposal fee boundary is unclear.",
      contractorQuestion:
        "Does the written scope include debris haul-away, dumpster fees, and final cleanup, or are any of those billed separately?",
    };
  }

  return {
    fieldKey: "debris_removal_included",
    label: "Debris Removal & Hauling",
    state: "not_detected",
    statusLabel: "Not detected in parsed quote",
    evidenceText,
    homeownerRiskCopy:
      "WindowMan did not detect explicit debris haul-away terms in the parsed quote.",
    contractorQuestion:
      "Is junk hauling and jobsite debris disposal included in this written contract total?",
  };
}

function buildRotItem(ext: ExtractionSlice): ScopeGapItem {
  const textBlob = [
    ext.substrate_allowance_text,
    ext.installation_scope_detail,
  ]
    .filter(Boolean)
    .join(" ");
  const textSignal = classifyScopeText(textBlob.length > 0 ? textBlob : null);

  let state: ScopeGapState;

  if (textSignal === "included") {
    state = "included";
  } else if (textSignal === "excluded") {
    state = "excluded";
  } else if (textSignal === "unclear") {
    state = "unclear";
  } else if (ext.rot_unit_pricing_present === true) {
    state = "unclear";
  } else if (ext.substrate_condition_clause_present === true) {
    state = "unclear";
  } else {
    state = "not_detected";
  }

  const evidenceText = pickEvidence(ext.substrate_allowance_text, ext.installation_scope_detail);

  if (state === "included") {
    return {
      fieldKey: "rot_unit_pricing_present",
      label: "Substrate & Wood Rot Repair",
      state,
      statusLabel: "Included in writing",
      evidenceText,
      homeownerRiskCopy:
        "The parsed quote appears to include written substrate or wood-rot repair responsibility in base scope.",
      contractorQuestion:
        "Please confirm the written rate or allowance for substrate, buck, or wood-rot repair before work starts.",
    };
  }

  if (state === "excluded") {
    return {
      fieldKey: "rot_unit_pricing_present",
      label: "Substrate & Wood Rot Repair",
      state,
      statusLabel: "Explicitly excluded / owner responsibility",
      evidenceText,
      homeownerRiskCopy:
        "The parsed quote appears to carve hidden framing or substrate repair out of included scope.",
      contractorQuestion:
        "What written unit price applies if buck, frame, or substrate replacement is required?",
    };
  }

  if (state === "unclear" && ext.rot_unit_pricing_present === true) {
    return {
      fieldKey: "rot_unit_pricing_present",
      label: "Substrate & Wood Rot Repair",
      state,
      statusLabel: "Written pricing method detected",
      evidenceText,
      homeownerRiskCopy:
        "The parsed quote appears to define how substrate or wood-rot repair would be priced if needed, but base-scope responsibility still needs confirmation.",
      contractorQuestion:
        "If hidden dry rot or substrate damage is uncovered after removal, what is the exact written rate or allowance to repair it?",
    };
  }

  if (state === "unclear") {
    return {
      fieldKey: "rot_unit_pricing_present",
      label: "Substrate & Wood Rot Repair",
      state,
      statusLabel: "Needs written confirmation",
      evidenceText,
      homeownerRiskCopy:
        "Wood rot or framing damage is referenced, but repair responsibility or pricing is unclear.",
      contractorQuestion:
        "If hidden dry rot is uncovered after removal, what is the exact written rate to repair it?",
    };
  }

  return {
    fieldKey: "rot_unit_pricing_present",
    label: "Substrate & Wood Rot Repair",
    state: "not_detected",
    statusLabel: "Not detected in parsed quote",
    evidenceText,
    homeownerRiskCopy:
      "WindowMan did not detect clear substrate or frame repair language in the parsed document.",
    contractorQuestion:
      "Are opening preparation and frame substrate adjustments covered under the base project scope?",
  };
}

function textHasVaguePhrase(text: string | null): boolean {
  if (!text) return false;
  const normalized = normalizeText(text);
  return VAGUE_PHRASES.some((p) => normalized.includes(p));
}

function buildWaterproofingItem(ext: ExtractionSlice): ScopeGapItem {
  const methodText = ext.waterproofing_method_text;
  const textSignal = classifyScopeText(methodText);

  let state: ScopeGapState;
  if (!methodText) {
    state = "not_detected";
  } else if (textSignal) {
    state = textSignal;
  } else if (textHasVaguePhrase(methodText)) {
    state = "unclear";
  } else {
    state = "included";
  }

  const evidenceText = pickEvidence(methodText);

  if (state === "included") {
    return {
      fieldKey: "waterproofing_method_text",
      label: "Waterproofing & Perimeter Sealant",
      state,
      statusLabel: "Included in writing",
      evidenceText,
      homeownerRiskCopy:
        "The parsed quote includes written waterproofing, sealant, or perimeter-protection language.",
      contractorQuestion:
        "Please confirm the listed waterproofing method applies to every opening in the project.",
    };
  }

  if (state === "excluded") {
    return {
      fieldKey: "waterproofing_method_text",
      label: "Waterproofing & Perimeter Sealant",
      state,
      statusLabel: "Explicitly excluded / owner responsibility",
      evidenceText,
      homeownerRiskCopy:
        "The parsed quote appears to place some waterproofing or finish-seal responsibility outside included scope.",
      contractorQuestion:
        "Which waterproofing, flashing, or sealant responsibilities are excluded from the base scope?",
    };
  }

  if (state === "unclear") {
    return {
      fieldKey: "waterproofing_method_text",
      label: "Waterproofing & Perimeter Sealant",
      state,
      statusLabel: "Needs written confirmation",
      evidenceText,
      homeownerRiskCopy:
        "Waterproofing is mentioned, but method, material, or responsibility is not specific enough.",
      contractorQuestion:
        "What exact flashing, sealant, or perimeter waterproofing method will be used around each opening?",
    };
  }

  return {
    fieldKey: "waterproofing_method_text",
    label: "Waterproofing & Perimeter Sealant",
    state: "not_detected",
    statusLabel: "Not detected in parsed quote",
    evidenceText,
    homeownerRiskCopy:
      "WindowMan did not detect specific flashing, buck treatment, or perimeter waterproofing method language.",
    contractorQuestion:
      "What explicit flashing and perimeter waterproofing sealant methods will be used to protect the frame?",
  };
}

function buildStuccoItem(ext: ExtractionSlice): ScopeGapItem {
  const textSignal = classifyScopeText(ext.wall_repair_scope);
  const exclusionBool = booleanExclusionSignal(ext.post_install_stucco_excluded);
  const inclusionBool = booleanInclusionSignal(ext.stucco_repair_included);

  let state: ScopeGapState;
  if (exclusionBool === "excluded" || textSignal === "excluded") {
    state =
      inclusionBool === "included" || textSignal === "included" ? "unclear" : "excluded";
  } else {
    state = mergeSignals(inclusionBool, textSignal);
  }

  const evidenceText = pickEvidence(ext.wall_repair_scope);

  if (state === "included") {
    return {
      fieldKey: "stucco_repair_included",
      label: "Post-Installation Stucco Repair",
      state,
      statusLabel: "Included in writing",
      evidenceText,
      homeownerRiskCopy:
        "The parsed quote appears to include exterior stucco repair or finish-work responsibility.",
      contractorQuestion:
        "Please confirm the stucco repair finish standard and whether paint matching is included.",
    };
  }

  if (state === "excluded") {
    return {
      fieldKey: "stucco_repair_included",
      label: "Post-Installation Stucco Repair",
      state,
      statusLabel: "Explicitly excluded / owner responsibility",
      evidenceText,
      homeownerRiskCopy:
        "The parsed quote appears to place post-install stucco or exterior finish repair outside included contractor scope.",
      contractorQuestion:
        "Can stucco patching, finish repair, and paint touch-up be added to the written scope?",
    };
  }

  if (state === "unclear") {
    return {
      fieldKey: "stucco_repair_included",
      label: "Post-Installation Stucco Repair",
      state,
      statusLabel: "Needs written confirmation",
      evidenceText,
      homeownerRiskCopy:
        "Finish repair is referenced, but the exact stucco, paint, or touch-up responsibility is unclear.",
      contractorQuestion:
        "What finish standard applies to stucco, paint, drywall, and trim affected by installation?",
    };
  }

  return {
    fieldKey: "stucco_repair_included",
    label: "Post-Installation Stucco Repair",
    state: "not_detected",
    statusLabel: "Not detected in parsed quote",
    evidenceText,
    homeownerRiskCopy:
      "WindowMan did not detect stucco repair responsibility in the parsed quote.",
    contractorQuestion:
      "Who is responsible for patching and smoothing exterior stucco affected by frame removal?",
  };
}

function isOwnerResponsibleParty(value: string | null): boolean {
  if (!value) return false;
  const normalized = normalizeText(value);
  return (
    normalized.includes("owner") ||
    normalized.includes("homeowner") ||
    normalized.includes("customer")
  );
}

function buildPermitItem(ext: ExtractionSlice): ScopeGapItem {
  const detailsSignal = classifyScopeText(ext.permits_details);
  const partyExcluded =
    isOwnerResponsibleParty(ext.permits_responsible_party) ? "excluded" : null;

  let state: ScopeGapState;

  if (partyExcluded === "excluded" || detailsSignal === "excluded") {
    state =
      ext.permit_fees_itemized === true || ext.permits_included === true || detailsSignal === "included"
        ? "unclear"
        : "excluded";
  } else if (ext.permit_fees_itemized === true || ext.permits_included === true) {
    state = detailsSignal === "unclear" ? "unclear" : "included";
  } else {
    state = mergeSignals(detailsSignal, partyExcluded);
  }

  const evidenceText = pickEvidence(ext.permits_details);

  if (state === "included") {
    return {
      fieldKey: "permit_fees_itemized",
      label: "Itemized Municipal Permit Fees",
      state,
      statusLabel: "Included in writing",
      evidenceText,
      homeownerRiskCopy:
        "Permit fees or filing responsibility appear written into the parsed quote.",
      contractorQuestion:
        "Please confirm all permit filing and municipal fees are included in the contract total.",
    };
  }

  if (state === "excluded") {
    return {
      fieldKey: "permit_fees_itemized",
      label: "Itemized Municipal Permit Fees",
      state,
      statusLabel: "Explicitly excluded / owner responsibility",
      evidenceText,
      homeownerRiskCopy:
        "The parsed quote appears to place permit, filing, or inspection cost responsibility outside included scope.",
      contractorQuestion:
        "Which permit, engineering, or inspection coordination costs are excluded from the base contract total?",
    };
  }

  if (state === "unclear") {
    return {
      fieldKey: "permit_fees_itemized",
      label: "Itemized Municipal Permit Fees",
      state,
      statusLabel: "Needs written confirmation",
      evidenceText,
      homeownerRiskCopy:
        "Permits are mentioned, but itemized fees or processing responsibility is unclear.",
      contractorQuestion:
        "Are all city permit filing fees, engineering fees, and inspection coordination costs covered here?",
    };
  }

  return {
    fieldKey: "permit_fees_itemized",
    label: "Itemized Municipal Permit Fees",
    state: "not_detected",
    statusLabel: "Not detected in parsed quote",
    evidenceText,
    homeownerRiskCopy:
      "WindowMan did not detect clear permit-fee responsibility in the parsed quote.",
    contractorQuestion:
      "Who pays the permit, engineering, and inspection coordination costs if they are required?",
  };
}

function readExtractionSlice(extraction: Record<string, unknown>): ExtractionSlice {
  const installation = getRecord(extraction, "installation");
  const permits = getRecord(extraction, "permits");

  return {
    debris_removal_included: asBooleanOrNull(extraction.debris_removal_included),
    rot_unit_pricing_present: asBooleanOrNull(extraction.rot_unit_pricing_present),
    substrate_allowance_text: asTrimmedStringField(extraction.substrate_allowance_text),
    substrate_condition_clause_present: asBooleanOrNull(
      extraction.substrate_condition_clause_present,
    ),
    waterproofing_method_text: asTrimmedStringField(extraction.waterproofing_method_text),
    sealant_specified: asBooleanOrNull(extraction.sealant_specified),
    stucco_repair_included: asBooleanOrNull(extraction.stucco_repair_included),
    post_install_stucco_excluded: asBooleanOrNull(extraction.post_install_stucco_excluded),
    wall_repair_scope: asTrimmedStringField(extraction.wall_repair_scope),
    permit_fees_itemized: asBooleanOrNull(extraction.permit_fees_itemized),
    permits_included: permits ? asBooleanOrNull(permits.included) : null,
    permits_responsible_party: permits ? asTrimmedStringField(permits.responsible_party) : null,
    permits_details: permits ? asTrimmedStringField(permits.details) : null,
    installation_scope_detail: installation
      ? asTrimmedStringField(installation.scope_detail)
      : null,
    installation_disposal_included: installation
      ? asBooleanOrNull(installation.disposal_included)
      : null,
  };
}

export function mapFullReportToScopeGapChecklistProps(
  source: V2FullReportSource,
): ScopeGapChecklistProps | null {
  const fullJson = source.full_json;
  if (!fullJson) return null;

  const extraction = getRecord(fullJson, "extraction");
  if (!extraction) return null;

  const ext = readExtractionSlice(extraction);

  const phases: ScopeGapPhase[] = [
    {
      id: "site_prep_removal",
      title: "When old windows hit the driveway",
      subtitle: "Removal, protection, cleanup, and disposal responsibilities.",
      items: [buildDebrisItem(ext)],
    },
    {
      id: "exposed_opening",
      title: "Exposing the framing skeleton",
      subtitle: "Hidden conditions, buck work, wood rot, and opening-prep responsibility.",
      items: [buildRotItem(ext)],
    },
    {
      id: "waterproofing_fastening",
      title: "Sealing and fastening the opening",
      subtitle: "Waterproofing, sealant, flashing, anchoring, and installation method clarity.",
      items: [buildWaterproofingItem(ext)],
    },
    {
      id: "finish_work",
      title: "When the wall has to be rebuilt",
      subtitle: "Stucco, drywall, trim, paint, caulk, and final finish responsibility.",
      items: [buildStuccoItem(ext)],
    },
    {
      id: "permit_inspection_costs",
      title: "Filing and municipal clearance",
      subtitle:
        "Permit fees, engineering fees, inspection coordination, and product paperwork responsibility.",
      items: [buildPermitItem(ext)],
    },
  ];

  return {
    phases,
    summary: computeSummary(phases),
  };
}
