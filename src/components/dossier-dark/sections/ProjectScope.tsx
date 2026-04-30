import { SectionCard } from "../primitives/SectionCard";
import { KeyValueRow } from "../primitives/KeyValueRow";
import type { DossierFixture } from "../fixtures";

interface Props {
  data: Pick<
    DossierFixture,
    "total_openings" | "opening_types" | "installation_method" | "price_per_opening"
  >;
}

export function ProjectScope({ data }: Props) {
  const noop = () => {};
  return (
    <SectionCard eyebrow="Project Scope">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <KeyValueRow label="Total Openings" value={String(data.total_openings)} onEdit={noop} />
        <KeyValueRow label="Opening Types" value={data.opening_types} onEdit={noop} />
        <KeyValueRow label="Installation Method" value={data.installation_method} onEdit={noop} />
        <KeyValueRow label="Price per Opening" value={data.price_per_opening} onEdit={noop} />
      </div>
    </SectionCard>
  );
}
