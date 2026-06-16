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
      <p className="font-display text-lg font-extrabold text-slate-900">Upload your estimate</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        Your quote-check path is saved. Upload a PDF, photo, or screenshot to start the private
        review.
      </p>
      <UploadZone
        isVisible
        sessionId={sessionId}
        onScanStart={onScanStart}
      />
    </div>
  );
}
