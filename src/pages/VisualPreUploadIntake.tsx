/**
 * Visual lab shell for PreUploadIntake — mock/local state only.
 * Route: /visual/pre-upload-intake (not DEV-gated; unlisted from production nav).
 */

import { Helmet } from "react-helmet-async";
import PreUploadIntake from "@/components/forensic-report/PreUploadIntake";

export default function VisualPreUploadIntake() {
  return (
    <>
      <Helmet>
        <title>Visual Lab · Pre-Upload Intake</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div
        role="status"
        className="fixed top-0 inset-x-0 z-50 h-7 flex items-center justify-center text-[11px] font-mono uppercase tracking-wider text-amber-200 border-b border-amber-500/30 backdrop-blur bg-[#3068e8]/[0.21]"
      >
        VISUAL LAB · MOCK DATA · NOT PRODUCTION FLOW
      </div>
      <div className="pt-7">
        <PreUploadIntake />
      </div>
    </>
  );
}
