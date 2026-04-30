import { SectionCard } from "../primitives/SectionCard";
import { KeyValueRow } from "../primitives/KeyValueRow";
import { StatusPill } from "../primitives/StatusPill";
import type { DossierFixture } from "../fixtures";

interface Props {
  data: Pick<
    DossierFixture,
    "homeowner_name" | "property_address" | "property_type" | "wind_zone" | "code_jurisdiction"
  >;
}

export function PropertyProfile({ data }: Props) {
  return (
    <SectionCard eyebrow="Property Profile">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <KeyValueRow label="Homeowner" value={data.homeowner_name} />
        <KeyValueRow label="Address" value={data.property_address} />
        <KeyValueRow label="Property Type" value={data.property_type} />
        <KeyValueRow
          label="Wind Zone"
          value={data.wind_zone}
          pill={
            data.wind_zone.toUpperCase().includes("HVHZ") ? (
              <StatusPill variant="critical">HVHZ</StatusPill>
            ) : null
          }
        />
        <KeyValueRow label="Code Jurisdiction" value={data.code_jurisdiction} />
      </div>
    </SectionCard>
  );
}
