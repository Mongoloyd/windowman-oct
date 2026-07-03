/**
 * PropertyProfileCard — homeowner / property / type / wind zone / jurisdiction.
 * Renders only rows with non-null values; hides entire card if every field is null.
 */
import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import type { PropertyContextSourceLabel } from "@/lib/mapPropertyContext";

interface Props {
  homeownerName?: string | null;
  propertyAddress?: string | null;
  propertyType?: string | null;
  windZone?: string | null;
  codeJurisdiction?: string | null;
  windZoneSourceLabel?: "quote_visible" | null;
  codeJurisdictionSourceLabel?: "benchmark_reference" | "derived" | null;
}

function formatSourceLabel(label: PropertyContextSourceLabel): string {
  if (label === "quote_visible") return "Source: quote-visible";
  if (label === "benchmark_reference") return "Source: benchmark reference";
  return "Source: derived";
}

function SourceLabelMeta({ label }: { label: PropertyContextSourceLabel }) {
  return (
    <p className="mt-1 fr-text-t3 text-[11px] leading-snug opacity-90">
      {formatSourceLabel(label)}
    </p>
  );
}

export default function PropertyProfileCard(props: Props) {
  const hasHomeowner = Boolean(props.homeownerName);
  const hasAddress = Boolean(props.propertyAddress);
  const hasType = Boolean(props.propertyType);
  const hasWind = Boolean(props.windZone);
  const hasJurisdiction = Boolean(props.codeJurisdiction);

  const isJurisdictionOnly =
    hasJurisdiction && !hasHomeowner && !hasAddress && !hasType && !hasWind;

  if (!hasHomeowner && !hasAddress && !hasType && !hasWind && !hasJurisdiction) {
    return null;
  }

  if (isJurisdictionOnly) {
    return (
      <section className="fr-card fr-accent-l--info p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin
              size={14}
              className="shrink-0 text-[hsl(var(--fr-cyan))]"
              aria-hidden="true"
            />
            <div>
              <p className="fr-mono text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--fr-cyan))]">
                Jurisdiction Context
              </p>
              <p className="mt-0.5 fr-text-t3 text-xs leading-snug">
                Code benchmark geography for this quote review
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="fr-text-t1 text-base sm:text-lg font-bold leading-snug">
              {props.codeJurisdiction}
            </p>
            {props.codeJurisdictionSourceLabel ? (
              <SourceLabelMeta label={props.codeJurisdictionSourceLabel} />
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  const rows: {
    label: string;
    value: ReactNode;
    sourceLabel?: PropertyContextSourceLabel | null;
    wide?: boolean;
  }[] = [];

  if (props.homeownerName) {
    rows.push({
      label: "Homeowner",
      value: (
        <span className="font-semibold text-[hsl(var(--fr-text))]">{props.homeownerName}</span>
      ),
    });
  }
  if (props.propertyAddress) {
    rows.push({
      label: "Property",
      value: (
        <span className="fr-text-t1 text-sm sm:text-base leading-snug">{props.propertyAddress}</span>
      ),
      wide: true,
    });
  }
  if (props.propertyType) {
    rows.push({
      label: "Type",
      value: (
        <span className="fr-pill--verified inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
          {props.propertyType}
        </span>
      ),
    });
  }
  if (props.windZone) {
    rows.push({
      label: "Wind Zone",
      value: (
        <span className="fr-pill--critical inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
          {props.windZone}
        </span>
      ),
      sourceLabel: props.windZoneSourceLabel,
    });
  }
  if (props.codeJurisdiction) {
    rows.push({
      label: "Code Jurisdiction",
      value: (
        <span className="font-semibold text-[hsl(var(--fr-text))]">{props.codeJurisdiction}</span>
      ),
      sourceLabel: props.codeJurisdictionSourceLabel,
    });
  }

  return (
    <section className="fr-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
        <MapPin
          size={14}
          className="shrink-0 text-[hsl(var(--fr-cyan))]"
          aria-hidden="true"
        />
        <h2 className="fr-mono text-[11px] font-bold tracking-wider text-[hsl(var(--fr-cyan))]">
          PROPERTY PROFILE
        </h2>
      </div>
      <dl className="divide-y divide-white/10">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
              r.wide ? "sm:items-start" : ""
            }`}
          >
            <dt className="fr-text-t3 text-xs font-medium uppercase tracking-wide shrink-0">
              {r.label}
            </dt>
            <dd className={`fr-text-t2 text-sm sm:text-right ${r.wide ? "sm:max-w-[65%]" : ""}`}>
              {r.value}
              {r.sourceLabel ? <SourceLabelMeta label={r.sourceLabel} /> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
