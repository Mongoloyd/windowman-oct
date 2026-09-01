import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OracleProvenanceMode, OracleQueryRequest } from "@/lib/windowOracle";

type Props = {
  value: OracleQueryRequest;
  onChange: (next: OracleQueryRequest) => void;
  onSearch: () => void;
};

export function OracleSearchFilters({ value, onChange, onSearch }: Props) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
      data-testid="oracle-search-filters"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Field label="ZIP">
          <Input
            value={value.geography?.zip ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                geography: { ...value.geography, zip: e.target.value },
              })
            }
            placeholder="00001"
          />
        </Field>
        <Field label="County">
          <Input
            value={value.geography?.county ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                geography: { ...value.geography, county: e.target.value },
              })
            }
            placeholder="Synthetic Region A"
          />
        </Field>
        <Field label="Brand">
          <Input
            value={value.product?.brand ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                product: { ...value.product, brand: e.target.value },
              })
            }
            placeholder="PGT"
          />
        </Field>
        <Field label="Series">
          <Input
            value={value.product?.series ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                product: { ...value.product, series: e.target.value },
              })
            }
            placeholder="WinGuard"
          />
        </Field>
        <Field label="Project type">
          <Input
            value={value.project?.projectType ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                project: { ...value.project, projectType: e.target.value },
              })
            }
            placeholder="full_home"
          />
        </Field>
        <Field label="Date (months)">
          <Input
            type="number"
            value={value.dateRangeMonths ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                dateRangeMonths: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
            placeholder="12"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Provenance">
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={value.provenance}
            onChange={(e) =>
              onChange({
                ...value,
                provenance: e.target.value as OracleProvenanceMode,
              })
            }
          >
            <option value="QUOTED">Quoted</option>
            <option value="VERIFIED_SOLD">Verified Sold</option>
            <option value="COMPARE">Compare Quoted vs Sold</option>
          </select>
        </Field>
        <Field label="Homeowner PPO">
          <Input
            type="number"
            value={value.homeownerPpo ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                homeownerPpo: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder="2710"
          />
        </Field>
        <Button type="button" onClick={onSearch} className="h-10">
          Search market
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs text-slate-600">{label}</Label>
      {children}
    </div>
  );
}
