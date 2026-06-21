import UploadZone from "@/components/UploadZone";

export type NextdoorQuoteUploadProps = {
  sessionId: string;
  isVisible: boolean;
  onScanStart: (fileName: string, scanSessionId: string) => void;
};

export function NextdoorQuoteUpload({
  sessionId,
  isVisible,
  onScanStart,
}: NextdoorQuoteUploadProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="mt-6">
      <p className="font-display text-lg font-extrabold text-slate-900">Upload your quote</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        This is the upload step. Your quote file stays private.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        You&apos;ll see a safe preview first. Full details unlock after a quick phone check.
      </p>
      <UploadZone
        isVisible
        sessionId={sessionId}
        onScanStart={onScanStart}
      />
    </div>
  );
}
