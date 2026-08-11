import { CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketingConsentCheckbox } from "@/components/consent/MarketingConsentCheckbox";
import { CAMPAIGN_NQ2_CONFIG } from "./campaignNq2Content";
import { useCampaignNq2Capture } from "./useCampaignNq2Capture";
import type { CampaignNq2Field } from "./campaignNq2Types";

type CampaignNq2CaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FIELD_CONFIG: Array<{
  field: CampaignNq2Field;
  label: string;
  type: "text" | "tel" | "email";
  autoComplete: string;
  inputMode: "text" | "tel" | "email";
  placeholder: string;
}> = [
  {
    field: "firstName",
    label: "First Name",
    type: "text",
    autoComplete: "name",
    inputMode: "text",
    placeholder: "Your first name",
  },
  {
    field: "phone",
    label: "Phone Number",
    type: "tel",
    autoComplete: "tel",
    inputMode: "tel",
    placeholder: "(305) 555-1234",
  },
  {
    field: "email",
    label: "Email Address",
    type: "email",
    autoComplete: "email",
    inputMode: "email",
    placeholder: "you@example.com",
  },
];

export default function CampaignNq2CaptureDialog({
  open,
  onOpenChange,
}: CampaignNq2CaptureDialogProps) {
  const capture = useCampaignNq2Capture();
  const submitting = capture.submitState === "submitting";
  const succeeded = capture.submitState === "success";

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-xl border-slate-200 bg-white p-5 text-slate-950 shadow-2xl sm:max-w-lg sm:p-7">
        {succeeded ? (
          <div
            className="flex min-h-72 flex-col items-center justify-center px-2 py-8 text-center"
            role="status"
            aria-live="polite"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <DialogTitle className="mt-5 font-['Barlow_Condensed'] text-4xl font-black leading-none text-[#06143f]">
              Request received
            </DialogTitle>
            <DialogDescription className="mt-4 max-w-md text-base leading-7 text-slate-600">
              {CAMPAIGN_NQ2_CONFIG.successMessage}
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader className="pr-5 text-left">
              <DialogTitle className="font-['Barlow_Condensed'] text-4xl font-black leading-none tracking-tight text-[#06143f] sm:text-5xl">
                Get your free window quote
              </DialogTitle>
              <DialogDescription className="pt-2 text-[15px] leading-6 text-slate-600 sm:text-base">
                Share your contact details and WindowMan will follow up about
                the next step toward getting a contractor estimate.
              </DialogDescription>
            </DialogHeader>

            <form className="mt-1 space-y-4" onSubmit={capture.submit} noValidate>
              {FIELD_CONFIG.map((config, index) => {
                const error = capture.errors[config.field];
                const inputId = `campaign-nq2-${config.field}`;
                const errorId = `${inputId}-error`;

                return (
                  <div key={config.field}>
                    <Label
                      htmlFor={inputId}
                      className="mb-1.5 block text-sm font-bold text-[#06143f]"
                    >
                      {config.label}
                    </Label>
                    <Input
                      id={inputId}
                      type={config.type}
                      inputMode={config.inputMode}
                      autoComplete={config.autoComplete}
                      placeholder={config.placeholder}
                      value={capture.values[config.field]}
                      onChange={(event) =>
                        capture.updateField(config.field, event.target.value)
                      }
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      autoFocus={index === 0}
                      disabled={submitting}
                      className="h-12 rounded-lg border-slate-300 bg-white text-base text-slate-950 placeholder:text-slate-400 focus-visible:ring-blue-600"
                    />
                    {error ? (
                      <p
                        id={errorId}
                        className="mt-1.5 text-sm font-semibold text-orange-700"
                        role="alert"
                      >
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              })}

              {capture.serverMessage ? (
                <p
                  className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm font-semibold text-orange-900"
                  role="alert"
                >
                  {capture.serverMessage}
                </p>
              ) : null}

              <MarketingConsentCheckbox
                id="campaign-nq2-marketing-consent"
                checked={capture.marketingCommunicationsGranted}
                onChange={capture.updateMarketingConsent}
                disabled={submitting}
                variant="light"
              />

              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-[52px] w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-3.5 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(37,99,235,0.2)] transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                data-telemetry-event="campaign_nq2_capture_submit_clicked"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                    Saving request…
                  </>
                ) : (
                  CAMPAIGN_NQ2_CONFIG.primaryCta
                )}
              </button>

              <p className="text-left text-[11px] leading-[1.55] text-slate-500">
                By selecting{" "}
                <span className="font-bold text-slate-700">
                  {CAMPAIGN_NQ2_CONFIG.primaryCta}
                </span>
                , you request help obtaining a contractor estimate and authorize
                WindowMan to contact you by call, text message, or email about
                this request and related support. This service authorization does
                not include marketing. Message and data rates may apply. You
                acknowledge the{" "}
                <Link className="font-semibold text-blue-700 underline" to="/privacy">
                  Privacy Policy
                </Link>{" "}
                and agree to the{" "}
                <Link className="font-semibold text-blue-700 underline" to="/terms">
                  Terms of Service
                </Link>
                .
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
