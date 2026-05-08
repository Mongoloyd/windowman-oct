/**
 * PropertyProfileCard — homeowner / property / type / wind zone / jurisdiction.
 * Renders only rows with non-null values; hides entire card if every field is null.
 */
interface Props {
  homeownerName?: string | null;
  propertyAddress?: string | null;
  propertyType?: string | null;
  windZone?: string | null;
  codeJurisdiction?: string | null;
}

export default function PropertyProfileCard(props: Props) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (props.homeownerName) {
    rows.push({ label: "Homeowner", value: <span className="font-semibold">{props.homeownerName}</span> });
  }
  if (props.propertyAddress) {
    rows.push({ label: "Property", value: props.propertyAddress });
  }
  if (props.propertyType) {
    rows.push({
      label: "Type",
      value: (
        <span
          className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
          style={{
            background: "hsl(var(--fr-success) / 0.15)",
            color: "hsl(var(--fr-success))",
          }}
        >
          {props.propertyType}
        </span>
      ),
    });
  }
  if (props.windZone) {
    rows.push({
      label: "Wind Zone",
      value: (
        <span
          className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
          style={{
            background: "hsl(var(--fr-danger) / 0.15)",
            color: "hsl(var(--fr-danger))",
          }}
        >
          {props.windZone}
        </span>
      ),
    });
  }
  if (props.codeJurisdiction) {
    rows.push({ label: "Code Jurisdiction", value: <span className="font-semibold">{props.codeJurisdiction}</span> });
  }

  if (rows.length === 0) return null;

  return (
    <section className="fr-card p-5 sm:p-6">
      <h2 className="fr-mono text-[11px] font-bold text-[hsl(var(--fr-cyan))] mb-4">
        ⌂ PROPERTY PROFILE
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-[hsl(var(--fr-text-muted))]">{r.label}</dt>
            <dd className="text-[hsl(var(--fr-text))] text-right">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
