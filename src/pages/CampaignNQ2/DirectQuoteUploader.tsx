import { useRef, useState, type ChangeEvent } from "react";
import { FileUp } from "lucide-react";
import { handoffToCanonicalUpload } from "@/components/landing/landingHandoff";
import { CAMPAIGN_NQ2_CONFIG } from "./campaignNq2Content";

const ACCEPTED_FILE_PATTERN = /\.(pdf|png|jpe?g)$/i;

export default function DirectQuoteUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const openPicker = () => {
    setSelectionError(null);
    inputRef.current?.click();
  };

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    if (!ACCEPTED_FILE_PATTERN.test(file.name)) {
      setSelectionError("Choose a PDF, PNG, JPG, or JPEG quote file.");
      event.target.value = "";
      return;
    }

    setSelectionError(null);
    handoffToCanonicalUpload();
  };

  return (
    <div className="text-center sm:text-left">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileSelected}
        aria-label="Choose an existing contractor quote"
        data-telemetry-event="campaign_nq2_file_selected"
      />
      <button
        type="button"
        onClick={openPicker}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-2 text-[15px] font-bold text-blue-700 underline decoration-blue-300 decoration-2 underline-offset-4 transition hover:text-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4"
        aria-describedby="campaign-nq2-upload-note"
        data-telemetry-event="campaign_nq2_secondary_upload_cta_clicked"
      >
        <FileUp className="h-5 w-5" aria-hidden="true" />
        {CAMPAIGN_NQ2_CONFIG.secondaryCta}
      </button>

      <p
        id="campaign-nq2-upload-note"
        className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500 sm:mx-0"
      >
        Choose a PDF or image now. Contact details are not requested before the
        picker opens.
      </p>

      {selectionError ? (
        <p className="mt-2 text-sm font-semibold text-orange-700" role="alert">
          {selectionError}
        </p>
      ) : null}
    </div>
  );
}
