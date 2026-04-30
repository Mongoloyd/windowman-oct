import { TrendingUp } from "lucide-react";
import { SectionCard } from "../primitives/SectionCard";
import { KeyValueRow } from "../primitives/KeyValueRow";
import { StatusPill } from "../primitives/StatusPill";
import type { DossierFixture } from "../fixtures";

interface Props {
  data: Pick<
    DossierFixture,
    | "total_contract_price"
    | "market_index_price"
    | "overpayment_total"
    | "overpayment_pct"
    | "deposit_amount"
    | "deposit_percentage"
    | "payment_schedule"
    | "warranty_glass"
    | "warranty_frame"
    | "warranty_labor"
  >;
}

function warrantyPill(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("lifetime")) return <StatusPill variant="clear">Lifetime</StatusPill>;
  const yearsMatch = lower.match(/(\d+)\s*year/);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1], 10);
    if (years < 5) return <StatusPill variant="warning">{years}yr — Short</StatusPill>;
    return <StatusPill variant="clear">{years}yr</StatusPill>;
  }
  return null;
}

export function FinancialIntegrity({ data }: Props) {
  return (
    <SectionCard eyebrow="Financial Integrity" title="Contract Pricing Analysis">
      {/* Total contract price — large */}
      <div className="bg-dossier-surface/70 border border-dossier-border rounded-lg p-5 mb-4">
        <span className="text-xs uppercase tracking-wider text-dossier-txt-secondary">
          Total Contract Price
        </span>
        <div className="mt-1 font-mono text-3xl font-bold text-white">
          {data.total_contract_price}
        </div>
      </div>

      {/* Overpayment focal box */}
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 mb-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-6 h-6 text-dossier-danger shrink-0 mt-1" />
          <div className="flex-1">
            <span className="text-xs uppercase tracking-widest text-dossier-danger font-semibold">
              Estimated Overpayment
            </span>
            <div className="mt-1 font-mono text-4xl font-black text-dossier-danger">
              {data.overpayment_total}
            </div>
            <div className="mt-1 text-sm font-mono text-dossier-warning">
              {data.overpayment_pct} above market index
            </div>
            <div className="mt-3 text-sm text-slate-300">
              Market index for this scope:{" "}
              <span className="font-mono text-dossier-txt-primary">{data.market_index_price}</span>{" "}
              · Your contract:{" "}
              <span className="font-mono text-dossier-txt-primary">
                {data.total_contract_price}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <KeyValueRow label="Deposit Amount" value={data.deposit_amount} />
        <KeyValueRow
          label="Deposit Percentage"
          value={data.deposit_percentage}
          pill={
            parseInt(data.deposit_percentage) > 33 ? (
              <StatusPill variant="warning">High</StatusPill>
            ) : null
          }
        />
        <KeyValueRow label="Payment Schedule" value={data.payment_schedule} />
        <KeyValueRow
          label="Glass Warranty"
          value={data.warranty_glass}
          pill={warrantyPill(data.warranty_glass)}
        />
        <KeyValueRow
          label="Frame Warranty"
          value={data.warranty_frame}
          pill={warrantyPill(data.warranty_frame)}
        />
        <KeyValueRow
          label="Labor Warranty"
          value={data.warranty_labor}
          pill={warrantyPill(data.warranty_labor)}
        />
      </div>
    </SectionCard>
  );
}
