import type {
  QuoteMathLedgerLineItem,
  QuoteMathLedgerProps,
} from "../QuoteMathLedger.types";
import type { V2FullReportSource } from "./reportAccessAdapter.types";
import {
  asArray,
  asBooleanOrNull,
  asNumber,
  asString,
  getRecord,
  isRecord,
} from "./reportAccessAdapter.helpers";

function parseGlassMakeupType(
  value: unknown,
): QuoteMathLedgerLineItem["glass_makeup_type"] {
  const text = asString(value);
  if (text === null) return null;
  switch (text) {
    case "monolithic_laminated":
    case "insulated_laminated":
    case "laminated":
    case "insulated":
    case "tempered":
    case "unknown":
      return text;
    default:
      return null;
  }
}

function mapLineItem(raw: unknown): QuoteMathLedgerLineItem | null {
  if (!isRecord(raw)) return null;
  const item = raw;

  const description = asString(item.description);
  if (description === null) return null;

  const quantity = asNumber(item.quantity);
  const unitPrice = asNumber(item.unit_price);
  let totalPrice = asNumber(item.total_price);

  if (totalPrice === null && unitPrice !== null && quantity !== null) {
    totalPrice = unitPrice * quantity;
  }

  const mapped: QuoteMathLedgerLineItem = { description };

  if (quantity !== null) mapped.quantity = quantity;
  if (unitPrice !== null) mapped.unit_price = unitPrice;
  if (totalPrice !== null) mapped.total_price = totalPrice;

  const brand = asString(item.brand);
  if (brand !== null) mapped.brand = brand;

  const series = asString(item.series);
  if (series !== null) mapped.series = series;

  const dimensions = asString(item.dimensions);
  if (dimensions !== null) mapped.dimensions = dimensions;

  const openingLocation = asString(item.opening_location);
  if (openingLocation !== null) mapped.opening_location = openingLocation;

  const openingTag = asString(item.opening_tag);
  if (openingTag !== null) mapped.opening_tag = openingTag;

  const noaNumber = asString(item.noa_number);
  if (noaNumber !== null) mapped.noa_number = noaNumber;

  const dpRating = asString(item.dp_rating);
  if (dpRating !== null) mapped.dp_rating = dpRating;

  const glassPackageText = asString(item.glass_package_text);
  if (glassPackageText !== null) mapped.glass_package_text = glassPackageText;

  const glassMakeupType = parseGlassMakeupType(item.glass_makeup_type);
  if (glassMakeupType !== null) mapped.glass_makeup_type = glassMakeupType;

  const glassLowE = asBooleanOrNull(item.glass_low_e_present);
  if (glassLowE !== null) mapped.glass_low_e_present = glassLowE;

  const glassArgon = asBooleanOrNull(item.glass_argon_present);
  if (glassArgon !== null) mapped.glass_argon_present = glassArgon;

  const glassTint = asString(item.glass_tint_text);
  if (glassTint !== null) mapped.glass_tint_text = glassTint;

  const glassSpecComplete = asBooleanOrNull(item.glass_spec_complete);
  if (glassSpecComplete !== null) mapped.glass_spec_complete = glassSpecComplete;

  const productAssignment = asString(item.product_assignment_text);
  if (productAssignment !== null) mapped.product_assignment_text = productAssignment;

  return mapped;
}

export function mapFullReportToQuoteMathLedgerProps(
  source: V2FullReportSource,
): QuoteMathLedgerProps | null {
  const fullJson = source.full_json;
  if (!fullJson) return null;

  const extraction = getRecord(fullJson, "extraction");
  if (!extraction) return null;

  const rawLineItems = asArray(extraction.line_items);
  if (rawLineItems.length === 0 && !Array.isArray(extraction.line_items)) {
    return null;
  }

  const lineItems: QuoteMathLedgerLineItem[] = [];
  for (const rawItem of rawLineItems) {
    const mapped = mapLineItem(rawItem);
    if (mapped !== null) lineItems.push(mapped);
  }

  const proofOfRead = source.proof_of_read ?? null;

  const contractorName =
    asString(proofOfRead?.contractor_name) ??
    asString(extraction.contractor_name);

  const openingCount =
    asNumber(proofOfRead?.opening_count) ?? asNumber(extraction.opening_count);

  const derivedMetrics = getRecord(fullJson, "derived_metrics");
  const totals = getRecord(derivedMetrics, "totals");
  const totalQuotedPrice =
    asNumber(extraction.total_quoted_price) ??
    asNumber(totals?.contract_total);

  const confidenceScore = asNumber(source.confidence_score);

  const props: QuoteMathLedgerProps = { lineItems };

  if (contractorName !== null) props.contractorName = contractorName;
  if (openingCount !== null) props.openingCount = openingCount;
  if (totalQuotedPrice !== null) props.totalQuotedPrice = totalQuotedPrice;
  if (confidenceScore !== null) props.confidenceScore = confidenceScore;

  return props;
}
