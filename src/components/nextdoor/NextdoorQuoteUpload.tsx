import UploadZone from "@/components/UploadZone";
import { hasTrustedContactIdentity } from "@/components/TruthGateFlow";

export type NextdoorQuoteUploadProps = {
  sessionId: string;
  isVisible: boolean;
  onScanStart: (fileName: string, scanSessionId: string) => void;
  /** Contact-owned lead id (Sprint 2A) forwarded to UploadZone. */
  leadId?: string | null;
};

export function NextdoorQuoteUpload({
  sessionId,
  isVisible,
  onScanStart,
  leadId,
}: NextdoorQuoteUploadProps) {
  // Sprint 2E-B contact-owned upload contract: never mount a usable UploadZone
  // without a trusted leadId + sessionId pair. UI guard only — the backend
  // start-upload-scan-session remains the sole authority at bootstrap.
  if (!isVisible || !hasTrustedContactIdentity(leadId, sessionId)) {
    return null;
  }

  return (
    <div className="mt-6">
      <p className="font-display text-lg font-extrabold text-slate-900">Upload your quote</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        Your quote file stays private.
      </p>
      <UploadZone
        isVisible
        sessionId={sessionId}
        leadId={leadId}
        onScanStart={onScanStart}
      />
    </div>
  );
}
