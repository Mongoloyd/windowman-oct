import { SectionCard } from "../primitives/SectionCard";
import { KeyValueRow } from "../primitives/KeyValueRow";
import { StatusPill } from "../primitives/StatusPill";
import type { DossierFixture } from "../fixtures";

interface Props {
  data: Pick<
    DossierFixture,
    | "fl_approval_number"
    | "mdc_noa_number"
    | "fbc_edition"
    | "permit_fee_disclosed"
    | "missing_code_language"
  >;
}

export function Compliance({ data }: Props) {
  return (
    <SectionCard eyebrow="Compliance">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <KeyValueRow label="FL Approval Number" value={data.fl_approval_number} />
        <KeyValueRow label="MDC NOA Number" value={data.mdc_noa_number} />
        <KeyValueRow label="FBC Edition" value={data.fbc_edition} />
        <KeyValueRow
          label="Permit Fee Disclosed"
          value={data.permit_fee_disclosed ? "Yes" : "No"}
          pill={
            data.permit_fee_disclosed ? (
              <StatusPill variant="clear">Clear</StatusPill>
            ) : (
              <StatusPill variant="critical">Missing</StatusPill>
            )
          }
        />
        <KeyValueRow
          label="Missing Code Language"
          value={data.missing_code_language ? "Yes" : "No"}
          pill={
            data.missing_code_language ? (
              <StatusPill variant="critical">Detected</StatusPill>
            ) : (
              <StatusPill variant="clear">Clear</StatusPill>
            )
          }
        />
      </div>
    </SectionCard>
  );
}
