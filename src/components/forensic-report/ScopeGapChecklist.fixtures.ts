import type {
  ScopeGapChecklistProps,
  ScopeGapItem,
  ScopeGapPhase,
  ScopeGapSummaryCounts,
} from "./ScopeGapChecklist.types";

function countSummary(phases: ScopeGapPhase[]): ScopeGapSummaryCounts {
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

function buildProps(phases: ScopeGapPhase[]): ScopeGapChecklistProps {
  return { phases, summary: countSummary(phases) };
}

function item(partial: ScopeGapItem): ScopeGapItem {
  return partial;
}

const PHASE_SITE: Omit<ScopeGapPhase, "items"> = {
  id: "site_prep_removal",
  title: "When old windows hit the driveway",
  subtitle: "Removal, protection, cleanup, and disposal responsibilities.",
};

const PHASE_OPENING: Omit<ScopeGapPhase, "items"> = {
  id: "exposed_opening",
  title: "Exposing the framing skeleton",
  subtitle: "Hidden conditions, buck work, wood rot, and opening-prep responsibility.",
};

const PHASE_WATERPROOF: Omit<ScopeGapPhase, "items"> = {
  id: "waterproofing_fastening",
  title: "Sealing and fastening the opening",
  subtitle: "Waterproofing, sealant, flashing, anchoring, and installation method clarity.",
};

const PHASE_FINISH: Omit<ScopeGapPhase, "items"> = {
  id: "finish_work",
  title: "When the wall has to be rebuilt",
  subtitle: "Stucco, drywall, trim, paint, caulk, and final finish responsibility.",
};

const PHASE_PERMIT: Omit<ScopeGapPhase, "items"> = {
  id: "permit_inspection_costs",
  title: "Filing and municipal clearance",
  subtitle:
    "Permit fees, engineering fees, inspection coordination, and product paperwork responsibility.",
};

const DEBRIS_INCLUDED = item({
  fieldKey: "debris_removal_included",
  label: "Debris Removal & Hauling",
  state: "included",
  statusLabel: "Included in writing",
  evidenceText: "Section 4: All jobsite debris removal and haul-away included in contract total.",
  homeownerRiskCopy:
    "Debris cleanup and haul-away appear inside the parsed contract scope.",
  contractorQuestion:
    "Please confirm jobsite debris hauling and cleanup are included with no additional disposal fee.",
});

const DEBRIS_NOT_DETECTED = item({
  fieldKey: "debris_removal_included",
  label: "Debris Removal & Hauling",
  state: "not_detected",
  statusLabel: "Not detected in parsed quote",
  homeownerRiskCopy:
    "WindowMan did not detect explicit debris haul-away terms in the parsed quote.",
  contractorQuestion:
    "Is junk hauling and jobsite debris disposal included in this written contract total?",
});

const DEBRIS_EXCLUDED = item({
  fieldKey: "debris_removal_included",
  label: "Debris Removal & Hauling",
  state: "excluded",
  statusLabel: "Explicitly excluded / owner responsibility",
  evidenceText: "Exclusions: Homeowner responsible for dumpster rental and debris haul-off.",
  homeownerRiskCopy:
    "The parsed quote appears to place trash disposal or cleanup outside included contractor scope.",
  contractorQuestion:
    "Since debris removal appears excluded, can you provide a written add-on price for haul-away?",
});

const DEBRIS_UNCLEAR = item({
  fieldKey: "debris_removal_included",
  label: "Debris Removal & Hauling",
  state: "unclear",
  statusLabel: "Needs written confirmation",
  evidenceText: "Cleanup mentioned; disposal fee not itemized.",
  homeownerRiskCopy:
    "Debris or cleanup is mentioned, but the responsibility or disposal fee boundary is unclear.",
  contractorQuestion:
    "Does the written scope include debris haul-away, dumpster fees, and final cleanup, or are any of those billed separately?",
});

const DEBRIS_NA = item({
  fieldKey: "debris_removal_included",
  label: "Debris Removal & Hauling",
  state: "not_applicable",
  statusLabel: "Not applicable",
  homeownerRiskCopy: "This responsibility does not appear applicable to this project scenario.",
  contractorQuestion: "No confirmation question is required for this item.",
});

const ROT_INCLUDED = item({
  fieldKey: "rot_unit_pricing_present",
  label: "Substrate & Wood Rot Repair",
  state: "included",
  statusLabel: "Included in writing",
  evidenceText: "Wood rot repair billed at $85/LF as listed in allowance schedule.",
  homeownerRiskCopy:
    "The parsed quote appears to include written substrate or wood-rot repair pricing.",
  contractorQuestion:
    "Please confirm the written rate or allowance for substrate, buck, or wood-rot repair before work starts.",
});

const ROT_UNCLEAR = item({
  fieldKey: "rot_unit_pricing_present",
  label: "Substrate & Wood Rot Repair",
  state: "unclear",
  statusLabel: "Needs written confirmation",
  evidenceText: "Field conditions may require additional framing work.",
  homeownerRiskCopy:
    "Wood rot or framing damage is referenced, but repair responsibility or pricing is unclear.",
  contractorQuestion:
    "If hidden dry rot is uncovered after removal, what is the exact written rate to repair it?",
});

const ROT_NOT_DETECTED = item({
  fieldKey: "rot_unit_pricing_present",
  label: "Substrate & Wood Rot Repair",
  state: "not_detected",
  statusLabel: "Not detected in parsed quote",
  homeownerRiskCopy:
    "WindowMan did not detect clear substrate or frame repair language in the parsed document.",
  contractorQuestion:
    "Are opening preparation and frame substrate adjustments covered under the base project scope?",
});

const ROT_EXCLUDED = item({
  fieldKey: "rot_unit_pricing_present",
  label: "Substrate & Wood Rot Repair",
  state: "excluded",
  statusLabel: "Explicitly excluded / owner responsibility",
  evidenceText: "Substrate and rotten wood repairs billed separately at prevailing rates.",
  homeownerRiskCopy:
    "The parsed quote appears to carve hidden framing or substrate repair out of included scope.",
  contractorQuestion:
    "What written unit price applies if buck, frame, or substrate replacement is required?",
});

const ROT_NA = item({
  fieldKey: "rot_unit_pricing_present",
  label: "Substrate & Wood Rot Repair",
  state: "not_applicable",
  statusLabel: "Not applicable",
  homeownerRiskCopy: "This hidden-condition item is not applicable to this fixture scenario.",
  contractorQuestion: "No confirmation question is required for this item.",
});

const WATER_INCLUDED = item({
  fieldKey: "waterproofing_method_text",
  label: "Waterproofing & Perimeter Sealant",
  state: "included",
  statusLabel: "Included in writing",
  evidenceText: "Install per manufacturer spec with polyurethane sealant and flashing tape.",
  homeownerRiskCopy:
    "The parsed quote includes written waterproofing or sealant-method language.",
  contractorQuestion:
    "Please confirm the listed waterproofing method applies to every opening in the project.",
});

const WATER_UNCLEAR = item({
  fieldKey: "waterproofing_method_text",
  label: "Waterproofing & Perimeter Sealant",
  state: "unclear",
  statusLabel: "Needs written confirmation",
  evidenceText: "Professional waterproofing included.",
  homeownerRiskCopy:
    "Waterproofing is mentioned, but method, material, or responsibility is not specific enough.",
  contractorQuestion:
    "What exact flashing, sealant, or perimeter waterproofing method will be used around each opening?",
});

const WATER_NOT_DETECTED = item({
  fieldKey: "waterproofing_method_text",
  label: "Waterproofing & Perimeter Sealant",
  state: "not_detected",
  statusLabel: "Not detected in parsed quote",
  homeownerRiskCopy:
    "WindowMan did not detect specific flashing, buck treatment, or perimeter waterproofing method language.",
  contractorQuestion:
    "What explicit flashing and perimeter waterproofing sealant methods will be used to protect the frame?",
});

const WATER_EXCLUDED = item({
  fieldKey: "waterproofing_method_text",
  label: "Waterproofing & Perimeter Sealant",
  state: "excluded",
  statusLabel: "Explicitly excluded / owner responsibility",
  evidenceText: "Exterior sealant touch-up by others; contractor installs window only.",
  homeownerRiskCopy:
    "The parsed quote appears to place some waterproofing or finish-seal responsibility outside included scope.",
  contractorQuestion:
    "Which waterproofing, flashing, or sealant responsibilities are excluded from the base scope?",
});

const STUCCO_INCLUDED = item({
  fieldKey: "stucco_repair_included",
  label: "Post-Installation Stucco Repair",
  state: "included",
  statusLabel: "Included in writing",
  evidenceText: "Stucco patch and paint blend included per scope notes.",
  homeownerRiskCopy:
    "The parsed quote appears to include exterior stucco repair or finish-work responsibility.",
  contractorQuestion:
    "Please confirm the stucco repair finish standard and whether paint matching is included.",
});

const STUCCO_UNCLEAR = item({
  fieldKey: "stucco_repair_included",
  label: "Post-Installation Stucco Repair",
  state: "unclear",
  statusLabel: "Needs written confirmation",
  evidenceText: "Finish work as needed after installation.",
  homeownerRiskCopy:
    "Finish repair is referenced, but the exact stucco, paint, or touch-up responsibility is unclear.",
  contractorQuestion:
    "What finish standard applies to stucco, paint, drywall, and trim affected by installation?",
});

const STUCCO_NOT_DETECTED = item({
  fieldKey: "stucco_repair_included",
  label: "Post-Installation Stucco Repair",
  state: "not_detected",
  statusLabel: "Not detected in parsed quote",
  homeownerRiskCopy:
    "WindowMan did not detect stucco repair responsibility in the parsed quote.",
  contractorQuestion:
    "Who is responsible for patching and smoothing exterior stucco affected by frame removal?",
});

const STUCCO_EXCLUDED = item({
  fieldKey: "stucco_repair_included",
  label: "Post-Installation Stucco Repair",
  state: "excluded",
  statusLabel: "Explicitly excluded / owner responsibility",
  evidenceText: "Stucco and paint repair excluded; homeowner to coordinate finish trades.",
  homeownerRiskCopy:
    "The parsed quote appears to exclude post-install stucco or exterior finish repair from contractor responsibility.",
  contractorQuestion:
    "Can stucco patching, finish repair, and paint touch-up be added to the written scope?",
});

const PERMIT_INCLUDED = item({
  fieldKey: "permit_fees_itemized",
  label: "Itemized Municipal Permit Fees",
  state: "included",
  statusLabel: "Included in writing",
  evidenceText: "Permit filing and municipal fees included — $1,250 line item.",
  homeownerRiskCopy:
    "Permit fees or filing responsibility appear written into the parsed quote.",
  contractorQuestion:
    "Please confirm all permit filing and municipal fees are included in the contract total.",
});

const PERMIT_UNCLEAR = item({
  fieldKey: "permit_fees_itemized",
  label: "Itemized Municipal Permit Fees",
  state: "unclear",
  statusLabel: "Needs written confirmation",
  evidenceText: "Permits to be obtained; fees TBD.",
  homeownerRiskCopy:
    "Permits are mentioned, but itemized fees or processing responsibility is unclear.",
  contractorQuestion:
    "Are all city permit filing fees, engineering fees, and inspection coordination costs covered here?",
});

const PERMIT_NOT_DETECTED = item({
  fieldKey: "permit_fees_itemized",
  label: "Itemized Municipal Permit Fees",
  state: "not_detected",
  statusLabel: "Not detected in parsed quote",
  homeownerRiskCopy:
    "WindowMan did not detect clear permit-fee responsibility in the parsed quote.",
  contractorQuestion:
    "Who pays the permit, engineering, and inspection coordination costs if they are required?",
});

const PERMIT_EXCLUDED = item({
  fieldKey: "permit_fees_itemized",
  label: "Itemized Municipal Permit Fees",
  state: "excluded",
  statusLabel: "Explicitly excluded / owner responsibility",
  evidenceText: "Homeowner to pull permits and pay all municipal fees directly.",
  homeownerRiskCopy:
    "The parsed quote appears to place permit, filing, or inspection cost responsibility outside included scope.",
  contractorQuestion:
    "Which permit, engineering, or inspection coordination costs are excluded from the base contract total?",
});

export const FIX_SCOPE_PROTECTED: ScopeGapChecklistProps = buildProps([
  { ...PHASE_SITE, items: [DEBRIS_INCLUDED, DEBRIS_NA] },
  { ...PHASE_OPENING, items: [ROT_INCLUDED] },
  { ...PHASE_WATERPROOF, items: [WATER_INCLUDED] },
  { ...PHASE_FINISH, items: [STUCCO_INCLUDED, STUCCO_UNCLEAR] },
  { ...PHASE_PERMIT, items: [PERMIT_INCLUDED] },
]);

export const FIX_SCOPE_GAPS: ScopeGapChecklistProps = buildProps([
  { ...PHASE_SITE, items: [DEBRIS_NOT_DETECTED, DEBRIS_UNCLEAR] },
  { ...PHASE_OPENING, items: [ROT_NOT_DETECTED, ROT_UNCLEAR] },
  { ...PHASE_WATERPROOF, items: [WATER_INCLUDED, WATER_NOT_DETECTED] },
  { ...PHASE_FINISH, items: [STUCCO_EXCLUDED] },
  { ...PHASE_PERMIT, items: [PERMIT_UNCLEAR] },
]);

export const FIX_SCOPE_EXCLUDED: ScopeGapChecklistProps = buildProps([
  { ...PHASE_SITE, items: [DEBRIS_EXCLUDED] },
  { ...PHASE_OPENING, items: [ROT_EXCLUDED] },
  { ...PHASE_WATERPROOF, items: [WATER_EXCLUDED] },
  { ...PHASE_FINISH, items: [STUCCO_EXCLUDED, STUCCO_NOT_DETECTED, STUCCO_INCLUDED] },
  { ...PHASE_PERMIT, items: [PERMIT_EXCLUDED, PERMIT_UNCLEAR] },
]);
