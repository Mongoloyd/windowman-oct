import { SectionCard } from "../primitives/SectionCard";
import { KeyValueRow } from "../primitives/KeyValueRow";
import { StatusPill } from "../primitives/StatusPill";
import type { DossierFixture } from "../fixtures";

interface Props {
  data: Pick<
    DossierFixture,
    | "brand_manufacturer"
    | "product_series"
    | "dp_rating"
    | "dp_compliant"
    | "impact_rating"
    | "impact_compliant"
    | "glass_composition"
    | "frame_material"
  >;
}

export function ProductEngineering({ data }: Props) {
  return (
    <SectionCard eyebrow="Product Engineering">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <KeyValueRow label="Brand / Manufacturer" value={data.brand_manufacturer} />
        <KeyValueRow label="Product Series" value={data.product_series} />
        <KeyValueRow
          label="DP Rating"
          value={data.dp_rating}
          pill={
            data.dp_compliant ? (
              <StatusPill variant="clear">Compliant</StatusPill>
            ) : (
              <StatusPill variant="critical">Non-compliant</StatusPill>
            )
          }
        />
        <KeyValueRow
          label="Impact Rating"
          value={data.impact_rating}
          pill={
            data.impact_compliant ? (
              <StatusPill variant="clear">Compliant</StatusPill>
            ) : (
              <StatusPill variant="critical">Non-compliant</StatusPill>
            )
          }
        />
        <KeyValueRow label="Glass Composition" value={data.glass_composition} />
        <KeyValueRow label="Frame Material" value={data.frame_material} />
      </div>
    </SectionCard>
  );
}
