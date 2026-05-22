/**
 * QuoteMathLedger — lab-only forensic line-item ledger (full reveal companion).
 * Renders OCR-extracted quote math; no fetch, no backend imports.
 */
import type {
  ProofBadge,
  QuoteMathLedgerLineItem,
  QuoteMathLedgerProps,
} from "./QuoteMathLedger.types";
import { FR } from "./tokens";

const DEFAULT_MAX_ROWS = 200;
const DEFAULT_LOCALE = "en-US";
const DEFAULT_CURRENCY = "USD";

function isPresent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number" && Number.isNaN(value)) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function formatCurrency(
  value: number | null | undefined,
  locale: string,
  currency: string,
): string {
  if (!isPresent(value) || typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

function formatQuantity(value: number | null | undefined): string {
  if (!isPresent(value) || typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

function formatConfidence(value: number | null | undefined): string {
  if (!isPresent(value) || typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  let pct = value;
  if (value >= 0 && value <= 1) pct = value * 100;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return `${clamped}%`;
}

function deriveLineTotal(item: QuoteMathLedgerLineItem): number | null {
  if (isPresent(item.total_price) && typeof item.total_price === "number") {
    return item.total_price;
  }
  const qty = item.quantity;
  const unit = item.unit_price;
  if (
    typeof qty === "number" &&
    typeof unit === "number" &&
    !Number.isNaN(qty) &&
    !Number.isNaN(unit) &&
    qty > 0
  ) {
    return unit * qty;
  }
  return null;
}

function getProofBadges(item: QuoteMathLedgerLineItem): ProofBadge[] {
  const badges: ProofBadge[] = [];
  if (!isPresent(item.noa_number)) badges.push("NOA not detected");
  if (!isPresent(item.dp_rating)) badges.push("DP rating not detected");
  if (!isPresent(item.brand)) badges.push("Brand not detected");
  if (!isPresent(item.series)) badges.push("Series not detected");
  if (!isPresent(item.glass_package_text) || item.glass_spec_complete === false) {
    badges.push("Glass package unclear");
  }
  return badges.slice(0, 5);
}

function badgeClassName(badge: ProofBadge | "Core fields detected"): string {
  const base = "inline-flex rounded-md px-2 py-0.5 text-xs font-medium border";
  if (badge === "Core fields detected") {
    return `${base} border-emerald-500/40 text-emerald-300 bg-emerald-950/30`;
  }
  if (badge === "NOA not detected" || badge === "DP rating not detected") {
    return `${base} border-red-500/40 text-red-300 bg-red-950/40`;
  }
  return `${base} border-amber-500/40 text-amber-300 bg-amber-950/30`;
}

function displayOrDash(value: string | null | undefined): string {
  return isPresent(value) && typeof value === "string" ? value : "—";
}

function rowHasPermitGap(item: QuoteMathLedgerLineItem): boolean {
  return !isPresent(item.noa_number) || !isPresent(item.dp_rating);
}

interface ResolvedProps {
  lineItems: QuoteMathLedgerLineItem[];
  contractorName?: string | null;
  totalQuotedPrice?: number | null;
  openingCount?: number | null;
  confidenceScore?: number | null;
  locale: string;
  currency: string;
  maxRows: number;
}

function resolveProps(props: QuoteMathLedgerProps): ResolvedProps {
  return {
    lineItems: Array.isArray(props.lineItems) ? props.lineItems : [],
    contractorName: props.contractorName,
    totalQuotedPrice: props.totalQuotedPrice,
    openingCount: props.openingCount,
    confidenceScore: props.confidenceScore,
    locale: props.locale ?? DEFAULT_LOCALE,
    currency: props.currency ?? DEFAULT_CURRENCY,
    maxRows: props.maxRows ?? DEFAULT_MAX_ROWS,
  };
}

function FilterHeader() {
  return (
    <header className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[hsl(var(--fr-cyan))]">
        WHAT WINDOWMAN READ
      </p>
      <h2 id="qml-title" className="text-xl sm:text-2xl font-bold text-[hsl(var(--fr-text))]">
        Quote Math Ledger
      </h2>
      <p className="text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed max-w-3xl">
        WindowMan separated the sales pitch from the math. These are the quote rows and proof
        fields detected in the parsed document.
      </p>
      <p className="text-xs text-[hsl(var(--fr-text-dim))] leading-relaxed border-l-2 border-[hsl(var(--fr-border))] pl-3">
        <span className="font-semibold text-[hsl(var(--fr-text-muted))]">WindowMan Filter:</span>{" "}
        We use the parsed quote math to show what was detected, what was not detected, and what
        the contractor should confirm before you sign.
      </p>
    </header>
  );
}

function SummaryChips({
  lineItemCount,
  openingCount,
  contractorName,
  totalQuotedPrice,
  confidenceScore,
  locale,
  currency,
}: {
  lineItemCount: number;
  openingCount?: number | null;
  contractorName?: string | null;
  totalQuotedPrice?: number | null;
  confidenceScore?: number | null;
  locale: string;
  currency: string;
}) {
  const chips: { label: string; value: string }[] = [
    { label: "Line items detected", value: String(lineItemCount) },
  ];
  if (isPresent(openingCount) && typeof openingCount === "number") {
    chips.push({ label: "Openings", value: String(openingCount) });
  }
  if (isPresent(contractorName) && typeof contractorName === "string") {
    chips.push({ label: "Contractor", value: contractorName });
  }
  if (isPresent(totalQuotedPrice)) {
    chips.push({
      label: "Total quoted",
      value: formatCurrency(totalQuotedPrice, locale, currency),
    });
  }
  if (isPresent(confidenceScore)) {
    chips.push({
      label: "OCR confidence",
      value: formatConfidence(confidenceScore),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <div
            key={chip.label}
            className="inline-flex flex-col rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/60 px-3 py-2 min-w-[120px]"
          >
            <span className="text-[10px] uppercase tracking-wide text-[hsl(var(--fr-text-dim))]">
              {chip.label}
            </span>
            <span className="mt-0.5 text-sm font-semibold tabular-nums text-[hsl(var(--fr-text))] text-right">
              {chip.value}
            </span>
          </div>
        ))}
        <div className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
          OCR-extracted · Not independently verified
        </div>
      </div>
      <p className="text-xs text-[hsl(var(--fr-text-dim))] leading-relaxed">
        This ledger reflects what WindowMan detected in the parsed quote. Supporting documents,
        attachments, or later contractor revisions may contain additional details.
      </p>
    </div>
  );
}

function ProofBadgeStack({
  item,
  description,
}: {
  item: QuoteMathLedgerLineItem;
  description: string;
}) {
  const badges = getProofBadges(item);
  const label = description.trim() || "line item";

  return (
    <div
      className="flex flex-col gap-1"
      aria-label={`Document proof status for ${label}`}
    >
      {badges.length === 0 ? (
        <span className={badgeClassName("Core fields detected")}>Core fields detected</span>
      ) : (
        badges.map((badge) => (
          <span key={badge} className={badgeClassName(badge)}>
            {badge}
          </span>
        ))
      )}
    </div>
  );
}

function ProductIdStack({ item }: { item: QuoteMathLedgerLineItem }) {
  const tag = isPresent(item.opening_tag) ? (
    <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-[hsl(var(--fr-text-muted))]">
      {item.opening_tag}
    </span>
  ) : null;

  return (
    <div className="space-y-1 text-xs text-[hsl(var(--fr-text-muted))]">
      <div>
        <span className="text-[hsl(var(--fr-text-dim))]">Brand: </span>
        {displayOrDash(item.brand)}
      </div>
      <div>
        <span className="text-[hsl(var(--fr-text-dim))]">Series: </span>
        {displayOrDash(item.series)}
      </div>
      <div>
        <span className="text-[hsl(var(--fr-text-dim))]">Dimensions: </span>
        {displayOrDash(item.dimensions)}
      </div>
      <div>
        <span className="text-[hsl(var(--fr-text-dim))]">Opening: </span>
        {displayOrDash(item.opening_location)}
        {tag ? <span className="ml-1">{tag}</span> : null}
      </div>
      {isPresent(item.glass_package_text) ? (
        <div>
          <span className="text-[hsl(var(--fr-text-dim))]">Glass: </span>
          {item.glass_package_text}
        </div>
      ) : null}
      {isPresent(item.product_assignment_text) ? (
        <div>
          <span className="text-[hsl(var(--fr-text-dim))]">Assignment: </span>
          {item.product_assignment_text}
        </div>
      ) : null}
    </div>
  );
}

function LedgerDesktopTable({
  items,
  locale,
  currency,
  maxRows,
  totalCount,
}: {
  items: QuoteMathLedgerLineItem[];
  locale: string;
  currency: string;
  maxRows: number;
  totalCount: number;
}) {
  const visible = items.slice(0, maxRows);
  const truncated = totalCount > maxRows;

  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">Quote line-item ledger</caption>
        <thead>
          <tr className="border-b border-[hsl(var(--fr-border))] text-left text-[10px] uppercase tracking-wide text-[hsl(var(--fr-text-dim))]">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Item
            </th>
            <th scope="col" className="py-2 px-2 font-semibold text-right">
              Qty
            </th>
            <th scope="col" className="py-2 px-2 font-semibold text-right">
              Unit Price
            </th>
            <th scope="col" className="py-2 px-2 font-semibold text-right">
              Total
            </th>
            <th scope="col" className="py-2 px-2 font-semibold">
              Product ID
            </th>
            <th scope="col" className="py-2 pl-2 font-semibold">
              Document Proof
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item, index) => {
            const desc = displayOrDash(item.description);
            const qtyStr = formatQuantity(item.quantity);
            const unitStr = formatCurrency(item.unit_price, locale, currency);
            const lineTotal = deriveLineTotal(item);
            const totalStr = formatCurrency(lineTotal, locale, currency);

            return (
              <tr
                key={`${desc}-${index}`}
                className="border-b border-[hsl(var(--fr-border))]/60 align-top"
              >
                <td className="py-3 pr-3 max-w-[220px]">
                  <span className="line-clamp-2 text-[hsl(var(--fr-text))]">{desc}</span>
                </td>
                <td
                  className="py-3 px-2 text-right tabular-nums text-[hsl(var(--fr-text))]"
                  aria-label={`Qty ${qtyStr}`}
                >
                  {qtyStr}
                </td>
                <td
                  className="py-3 px-2 text-right tabular-nums text-[hsl(var(--fr-text))]"
                  aria-label={`Unit Price ${unitStr}`}
                >
                  {unitStr}
                </td>
                <td
                  className="py-3 px-2 text-right tabular-nums text-[hsl(var(--fr-text))]"
                  aria-label={`Total ${totalStr}`}
                >
                  {totalStr}
                </td>
                <td className="py-3 px-2">
                  <ProductIdStack item={item} />
                </td>
                <td className="py-3 pl-2">
                  <ProofBadgeStack item={item} description={desc} />
                </td>
              </tr>
            );
          })}
          {truncated ? (
            <tr>
              <td
                colSpan={6}
                className="py-4 text-center text-xs text-[hsl(var(--fr-text-muted))]"
              >
                Showing {maxRows} of {totalCount}. Open the full quote PDF for the rest.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function LedgerMobileCards({
  items,
  locale,
  currency,
  maxRows,
  totalCount,
}: {
  items: QuoteMathLedgerLineItem[];
  locale: string;
  currency: string;
  maxRows: number;
  totalCount: number;
}) {
  const visible = items.slice(0, maxRows);
  const truncated = totalCount > maxRows;

  return (
    <div className="md:hidden space-y-4 max-w-full">
      {visible.map((item, index) => {
        const desc = displayOrDash(item.description);
        const qtyStr = formatQuantity(item.quantity);
        const unitStr = formatCurrency(item.unit_price, locale, currency);
        const lineTotal = deriveLineTotal(item);
        const totalStr = formatCurrency(lineTotal, locale, currency);

        return (
          <article
            key={`mobile-${desc}-${index}`}
            className="rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/50 p-4 space-y-3 break-words"
          >
            <div>
              <div className="text-[10px] uppercase text-[hsl(var(--fr-text-dim))]">Item</div>
              <div className="text-sm font-medium text-[hsl(var(--fr-text))] line-clamp-3">
                {desc}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-[hsl(var(--fr-text-dim))]">Qty</div>
                <div className="tabular-nums text-right font-medium" aria-label={`Qty ${qtyStr}`}>
                  {qtyStr}
                </div>
              </div>
              <div>
                <div className="text-[hsl(var(--fr-text-dim))]">Unit Price</div>
                <div
                  className="tabular-nums text-right font-medium"
                  aria-label={`Unit Price ${unitStr}`}
                >
                  {unitStr}
                </div>
              </div>
              <div>
                <div className="text-[hsl(var(--fr-text-dim))]">Total</div>
                <div
                  className="tabular-nums text-right font-medium"
                  aria-label={`Total ${totalStr}`}
                >
                  {totalStr}
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[hsl(var(--fr-text-dim))] mb-1">
                Product ID
              </div>
              <ProductIdStack item={item} />
            </div>
            <div>
              <div className="text-[10px] uppercase text-[hsl(var(--fr-text-dim))] mb-1">
                Document Proof
              </div>
              <ProofBadgeStack item={item} description={desc} />
            </div>
          </article>
        );
      })}
      {truncated ? (
        <p className="text-center text-xs text-[hsl(var(--fr-text-muted))]">
          Showing {maxRows} of {totalCount}. Open the full quote PDF for the rest.
        </p>
      ) : null}
    </div>
  );
}

function EmptyLedgerState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-[hsl(var(--fr-border))] bg-slate-900/40 p-8 text-center"
    >
      <h3 className="text-lg font-semibold text-[hsl(var(--fr-text))]">
        No line-item ledger could be built from this quote.
      </h3>
      <p className="mt-3 text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed max-w-xl mx-auto">
        WindowMan could not detect enough structured line-item math in the parsed document. Ask
        the contractor for an itemized schedule with quantity, product series, NOA number, DP
        rating, and unit pricing.
      </p>
    </div>
  );
}

function ConfirmationChecklist({ allCoreDetected }: { allCoreDetected: boolean }) {
  const staticItems = [
    "Ask contractor to confirm NOA numbers.",
    "Ask contractor to confirm DP ratings.",
    "Ask contractor to confirm glass package by opening.",
    "Ask contractor to confirm brand and series per product.",
  ];

  return (
    <div className="rounded-lg border border-[hsl(var(--fr-border))] bg-slate-950/50 p-5 sm:p-6">
      <p className="text-sm text-[hsl(var(--fr-text-muted))] mb-3">
        Before signing, ask the contractor to confirm these items in writing.
      </p>
      <h3 className="text-base font-bold text-[hsl(var(--fr-text))]">
        Needs Contractor Confirmation
      </h3>
      {allCoreDetected ? (
        <p className="mt-3 text-sm text-[hsl(var(--fr-text-muted))] leading-relaxed">
          All core proof fields were detected in the parsed quote. Still ask the contractor to
          provide signed product approval sheets at contract.
        </p>
      ) : (
        <ul role="list" className="mt-3 space-y-2 list-disc list-inside text-sm text-[hsl(var(--fr-text-muted))]">
          {staticItems.map((item) => (
            <li key={item} aria-label={item}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function QuoteMathLedger(props: QuoteMathLedgerProps) {
  const resolved = resolveProps(props);
  const { lineItems, locale, currency, maxRows } = resolved;
  const isEmpty = lineItems.length === 0;
  const anyPermitGap = lineItems.some(rowHasPermitGap);
  const allCoreDetected =
    lineItems.length > 0 &&
    lineItems.every((item) => getProofBadges(item).length === 0);

  return (
    <section
      className={`report-dark ${FR.cardPad} rounded-xl border border-[hsl(var(--fr-border))] bg-slate-950/70 ${FR.sectionGap}`}
      aria-labelledby="qml-title"
    >
      <FilterHeader />
      <SummaryChips
        lineItemCount={lineItems.length}
        openingCount={resolved.openingCount}
        contractorName={resolved.contractorName}
        totalQuotedPrice={resolved.totalQuotedPrice}
        confidenceScore={resolved.confidenceScore}
        locale={locale}
        currency={currency}
      />

      {isEmpty ? (
        <EmptyLedgerState />
      ) : (
        <>
          {anyPermitGap ? (
            <p className="text-xs text-[hsl(var(--fr-text-muted))] border border-[hsl(var(--fr-border))] rounded-md px-3 py-2 bg-slate-900/40">
              Permit readiness note: Product approval and design-pressure fields should be
              confirmed before signing or permit filing.
            </p>
          ) : null}
          <LedgerDesktopTable
            items={lineItems}
            locale={locale}
            currency={currency}
            maxRows={maxRows}
            totalCount={lineItems.length}
          />
          <LedgerMobileCards
            items={lineItems}
            locale={locale}
            currency={currency}
            maxRows={maxRows}
            totalCount={lineItems.length}
          />
        </>
      )}

      <ConfirmationChecklist allCoreDetected={allCoreDetected && !isEmpty} />
    </section>
  );
}
