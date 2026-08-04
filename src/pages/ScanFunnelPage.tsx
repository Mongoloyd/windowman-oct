/**
 * ScanFunnelPage — V2 quote-scan funnel at `/scan`.
 *
 * Sprint 1: renders the static `ScanLandingExperience` visual foundation.
 * The route is mounted in App.tsx only behind `VITE_SCAN_ROUTE_MOUNTED === "true"`,
 * and the page is noindex while the funnel behind it is not connected.
 * Production wiring (upload custody, scanner, lead capture, reveal) lands in
 * follow-up sprints. Homepage `/` and Edge Functions remain unchanged.
 *
 * ScanFunnelProvider wraps the app in App.tsx — no duplicate provider here.
 */

import { Helmet } from "react-helmet-async";
import ScanLandingExperience from "@/components/scan/ScanLandingExperience";

export default function ScanFunnelPage() {
  return (
    <>
      <Helmet>
        <title>Scan Your Quote | WindowMan</title>
        <meta
          name="description"
          content="Upload your impact window quote for a forensic truth report."
        />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <ScanLandingExperience />
    </>
  );
}
