import type { ReactNode } from "react";
import { BarChart3, Boxes, MapPinned, Search } from "lucide-react";
import type { OracleProvenanceMode, OracleQueryRequest } from "@/lib/windowOracle";

type Props = {
  value: OracleQueryRequest;
  onChange: (next: OracleQueryRequest) => void;
  onSearch: () => void;
};

const REGION_OPTIONS = [
  { county: "Synthetic Region A", zips: ["00001", "00002", "00003"] },
  { county: "Synthetic Region B", zips: ["00011", "00012"] },
  { county: "Synthetic Region C", zips: ["00021", "00022"] },
] as const;

const PRODUCT_OPTIONS = [
  { brand: "PGT", series: "WinGuard" },
  { brand: "ES", series: "Series 500" },
  { brand: "CGI", series: "Sentinel" },
] as const;

const CONTROL_CLASS =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.07),0_2px_5px_rgba(15,23,42,0.05)] outline-none transition-[border-color,box-shadow,transform] hover:border-slate-400 focus-visible:border-[#4A92F9] focus-visible:ring-2 focus-visible:ring-[#4A92F9]/30";

export function OracleSearchFilters({ value, onChange, onSearch }: Props) {
  const selectedCounty = value.geography?.county ?? REGION_OPTIONS[0].county;
  const selectedRegion =
    REGION_OPTIONS.find((region) => region.county === selectedCounty) ??
    REGION_OPTIONS[0];
  const selectedBrand = value.product?.brand ?? PRODUCT_OPTIONS[0].brand;

  const updateCounty = (county: string) => {
    const region =
      REGION_OPTIONS.find((option) => option.county === county) ??
      REGION_OPTIONS[0];
    onChange({
      ...value,
      geography: { county: region.county, zip: region.zips[0] },
    });
  };

  const updateZip = (zip: string) => {
    const region =
      REGION_OPTIONS.find((option) => option.zips.some((item) => item === zip)) ??
      selectedRegion;
    onChange({
      ...value,
      geography: { county: region.county, zip },
    });
  };

  const updateBrand = (brand: string) => {
    const product =
      PRODUCT_OPTIONS.find((option) => option.brand === brand) ??
      PRODUCT_OPTIONS[0];
    onChange({
      ...value,
      product: { ...value.product, brand: product.brand, series: product.series },
    });
  };

  const updateSeries = (series: string) => {
    const product =
      PRODUCT_OPTIONS.find((option) => option.series === series) ??
      PRODUCT_OPTIONS[0];
    onChange({
      ...value,
      product: { ...value.product, brand: product.brand, series: product.series },
    });
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border-2 border-[#B9CAE0] bg-white shadow-[0_24px_48px_-28px_rgba(7,28,62,0.42),0_8px_20px_-16px_rgba(74,146,249,0.28),inset_0_1px_0_rgba(255,255,255,0.96)]"
      data-testid="oracle-search-filters"
      aria-labelledby="synthetic-query-title"
    >
      <div className="flex flex-col gap-2 border-b-2 border-[#CAD8E8] bg-[#F5F9FE] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#356AC3]">
            Controlled fixture inputs
          </p>
          <h2 id="synthetic-query-title" className="mt-1 text-lg font-black tracking-tight text-slate-950">
            Synthetic cohort query
          </h2>
        </div>
        <p className="max-w-md text-xs font-semibold leading-5 text-slate-600">
          Options are limited to known fixture combinations. No live geography or market source is queried.
        </p>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[1.05fr_1.2fr_0.95fr]">
        <ControlGroup icon={<MapPinned className="h-4 w-4" />} label="Cohort scope" tone="blue">
          <Field label="Synthetic region">
            <select aria-label="Synthetic region" className={CONTROL_CLASS} value={selectedCounty} onChange={(event) => updateCounty(event.target.value)}>
              {REGION_OPTIONS.map((region) => <option key={region.county} value={region.county}>{region.county}</option>)}
            </select>
          </Field>
          <Field label="Synthetic ZIP">
            <select aria-label="Synthetic ZIP" className={`${CONTROL_CLASS} font-mono tabular-nums`} value={value.geography?.zip ?? selectedRegion.zips[0]} onChange={(event) => updateZip(event.target.value)}>
              {selectedRegion.zips.map((zip) => <option key={zip} value={zip}>{zip}</option>)}
            </select>
          </Field>
          <Field label="Observation window" wide>
            <select aria-label="Observation window" className={`${CONTROL_CLASS} font-mono tabular-nums`} value={value.dateRangeMonths ?? 24} onChange={(event) => onChange({ ...value, dateRangeMonths: Number(event.target.value) })}>
              <option value={6}>Past 6 fixture months</option>
              <option value={12}>Past 12 fixture months</option>
              <option value={24}>Past 24 fixture months</option>
            </select>
          </Field>
        </ControlGroup>

        <ControlGroup icon={<Boxes className="h-4 w-4" />} label="Product package" tone="violet">
          <Field label="Brand fixture">
            <select aria-label="Brand fixture" className={CONTROL_CLASS} value={selectedBrand} onChange={(event) => updateBrand(event.target.value)}>
              {PRODUCT_OPTIONS.map((product) => <option key={product.brand} value={product.brand}>{product.brand}</option>)}
            </select>
          </Field>
          <Field label="Series fixture">
            <select aria-label="Series fixture" className={CONTROL_CLASS} value={value.product?.series ?? PRODUCT_OPTIONS[0].series} onChange={(event) => updateSeries(event.target.value)}>
              {PRODUCT_OPTIONS.map((product) => <option key={product.series} value={product.series}>{product.series}</option>)}
            </select>
          </Field>
          <Field label="Project type" wide>
            <select aria-label="Project type" className={CONTROL_CLASS} value={value.project?.projectType ?? "full_home"} onChange={(event) => onChange({ ...value, project: { ...value.project, projectType: event.target.value } })}>
              <option value="full_home">Full-home fixture</option>
              <option value="partial">Partial-project fixture</option>
            </select>
          </Field>
        </ControlGroup>

        <ControlGroup icon={<BarChart3 className="h-4 w-4" />} label="Evidence comparison" tone="emerald">
          <Field label="Evidence population" wide>
            <select aria-label="Evidence population" className={CONTROL_CLASS} value={value.provenance} onChange={(event) => onChange({ ...value, provenance: event.target.value as OracleProvenanceMode })}>
              <option value="QUOTED">Quoted evidence</option>
              <option value="VERIFIED_SOLD">Verified-sold evidence</option>
              <option value="COMPARE">Compare separated populations</option>
            </select>
          </Field>
          <Field label="Synthetic homeowner PPO" wide>
            <select aria-label="Synthetic homeowner PPO" className={`${CONTROL_CLASS} font-mono tabular-nums`} value={value.homeownerPpo ?? ""} onChange={(event) => onChange({ ...value, homeownerPpo: event.target.value ? Number(event.target.value) : null })}>
              <option value="">Not supplied</option>
              <option value={1750}>$1,750 / opening</option>
              <option value={2100}>$2,100 / opening</option>
              <option value={2710}>$2,710 / opening</option>
            </select>
          </Field>
        </ControlGroup>
      </div>

      <div className="flex flex-col gap-3 border-t-2 border-[#CAD8E8] bg-[#EDF5FF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Query execution</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">Recomputes the local synthetic fixture only.</p>
        </div>
        <button type="button" onClick={onSearch} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#4A92F9] bg-[#4A92F9] px-5 py-2.5 text-sm font-black text-[#071C3E] shadow-[0_5px_0_-2px_#215EA8,0_12px_24px_-14px_rgba(53,106,195,0.8)] transition-[box-shadow,transform] active:translate-y-px active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A] focus-visible:ring-offset-2 sm:w-auto" data-testid="oracle-query-action">
          <Search className="h-4 w-4" aria-hidden />
          Run synthetic query
        </button>
      </div>
    </section>
  );
}

function ControlGroup({
  icon,
  label,
  tone,
  children,
}: {
  icon: ReactNode;
  label: string;
  tone: "blue" | "violet" | "emerald";
  children: ReactNode;
}) {
  const toneClass = tone === "blue"
    ? "border-[#AFCBF0] bg-[#F5F9FF] text-[#245EAA]"
    : tone === "violet"
      ? "border-[#CEC3EB] bg-[#FAF8FF] text-[#6547A8]"
      : "border-[#AFDCCB] bg-[#F4FBF8] text-[#087A55]";

  return (
    <fieldset className={`grid min-w-0 grid-cols-2 gap-3 rounded-xl border-2 p-3 shadow-[0_8px_18px_-16px_rgba(15,23,42,0.55),inset_0_1px_0_rgba(255,255,255,0.95)] ${toneClass}`}>
      <legend className="col-span-2 mb-1 flex items-center gap-2 px-1 text-[11px] font-black uppercase tracking-[0.08em]">
        {icon}
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`min-w-0 space-y-1.5 text-slate-900 ${wide ? "col-span-2" : ""}`}>
      <span className="block text-[11px] font-black leading-4 text-slate-700 sm:text-xs">{label}</span>
      {children}
    </label>
  );
}
