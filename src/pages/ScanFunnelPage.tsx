/**
 * ScanFunnelPage — V2 quote-scan funnel at `/scan`.
 *
 * Sprint 2: renders the local `ScanLandingExperience` conversion prototype.
 * The route is mounted in App.tsx only behind `VITE_SCAN_ROUTE_MOUNTED === "true"`,
 * and the page is noindex while live upload / OTP / contractor network are not
 * connected. Homepage `/` and Edge Functions remain unchanged.
 *
 * ScanFunnelProvider wraps the app in App.tsx — no duplicate provider here.
 */

import { Helmet } from "react-helmet-async";
import ScanLandingExperience from "@/components/scan/ScanLandingExperience";

export default function ScanFunnelPage() {
  return (
    <>
      <Helmet>
        <title>Make Your Quote Compete | WindowMan</title>
        <meta
          name="description"
          content="Upload any real window or door estimate. WindowMan reviews price, scope, glass, warranty, and fine print—then prepares measured scope so contractors can compete."
        />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <ScanLandingExperience />
    </>
  );
}
