/**
 * ScanFunnelPage — V2 quote-scan funnel at `/scan`.
 *
 * Phase 6 scaffolding: registers the funnel canvas and mounts the V2 intake UI.
 * Production wiring (TruthGateFlow, UploadZone, ScanTheatrics) lands in follow-up work.
 * Homepage `/` and Edge Functions remain unchanged.
 *
 * ScanFunnelProvider wraps the app in App.tsx — no duplicate provider here.
 */

import { Helmet } from "react-helmet-async";
import PreUploadIntake from "@/components/forensic-report/PreUploadIntake";

export default function ScanFunnelPage() {
  return (
    <>
      <Helmet>
        <title>Scan Your Quote | WindowMan</title>
        <meta
          name="description"
          content="Upload your impact window quote for a forensic truth report."
        />
      </Helmet>
      <PreUploadIntake />
    </>
  );
}
