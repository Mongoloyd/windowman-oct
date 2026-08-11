import { useEffect, useRef } from "react";
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
import { CAMPAIGN_NQ_CONFIG } from "./campaignNqContent";
import { NQ_CTA_PRESSABLE } from "./campaignNqSurfaces";
import { useCampaignNqCapture } from "./useCampaignNqCapture";
import type { CampaignNqField } from "./campaignNqTypes";

type CampaignNqCaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FIELD_CONFIG: Array<{
  field: CampaignNqField;
  label: string;
  type: "text" | "tel" | "email";
  autoComplete: string;
  inputMode?: "text" | "tel" | "email";
  placeholder: string;
}> = [
  {
    field: "firstName",
    label: "First Name",
    type: "text",
    autoComplete: "given-name",
    inputMode: "text",
    placeholder: "Your first name",
  },
  {
    field: "phone",
    label: "Phone Number",
    type: "tel",
    autoComplete: "tel",
    inputMode: "tel",
    placeholder: "(555) 555-5555",
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

export default function CampaignNqCaptureDialog({
  open,
  onOpenChange,
}: CampaignNqCaptureDialogProps) {
  const capture = useCampaignNqCapture();
  const submitting = capture.submitState === "submitting";
  const succeeded = capture.submitState === "success";
  const successPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (succeeded) successPanelRef.current?.focus();
  }, [succeeded]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-700 border-t-slate-500 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_6px_rgba(2,6,23,0.6),0_32px_72px_-16px_rgba(2,6,23,0.9)] sm:max-w-lg [&>button]:text-slate-300 [&>button]:hover:text-white">
        {succeeded ? (
          <div
            ref={successPanelRef}
            tabIndex={-1}
            className="flex min-h-72 flex-col items-center justify-center px-2 py-8 text-center"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2
              className="h-12 w-12 text-sky-400"
              aria-hidden="true"
            />
            <DialogTitle className="mt-5 text-2xl font-bold">
              Request received
            </DialogTitle>
            <DialogDescription className="mt-3 max-w-md text-base leading-7 text-slate-300">
              {CAMPAIGN_NQ_CONFIG.successMessage}
            </DialogDescription>
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">
                First-quote request
              </p>
              <DialogTitle className="text-2xl font-bold text-white">
                Tell us where to reach you
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-300">
                This starts a request for help obtaining a contractor quote. It
                does not create or analyze a quote.
              </DialogDescription>
            </DialogHeader>

            <form className="mt-2 space-y-4" onSubmit={capture.submit} noValidate>
              {FIELD_CONFIG.map((config, index) => {
                const error = capture.errors[config.field];
                const inputId = `campaign-nq-${config.field}`;
                const errorId = `${inputId}-error`;

                return (
                  <div key={config.field}>
                    <Label
                      htmlFor={inputId}
                      className="mb-1.5 block text-sm font-semibold text-slate-100"
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
                      className="h-12 rounded-[var(--radius-input)] border-slate-700 bg-slate-950/70 text-base text-white shadow-[inset_0_2px_5px_rgba(2,6,23,0.7),inset_0_-1px_0_rgba(255,255,255,0.06)] placeholder:text-slate-500 focus-visible:ring-sky-400"
                    />
                    {error ? (
                      <p
                        id={errorId}
                        className="mt-1.5 text-sm text-rose-300"
                        role="alert"
                      >
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              })}

              <MarketingConsentCheckbox
                id="campaign-nq-marketing-consent"
                checked={capture.marketingConsent}
                onChange={capture.updateMarketingConsent}
                variant="dark"
              />

              {capture.serverMessage ? (
                <p
                  className="rounded-md border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200"
                  role="alert"
                >
                  {capture.serverMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className={`${NQ_CTA_PRESSABLE} w-full focus-visible:ring-white focus-visible:ring-offset-slate-950 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {submitting ? (
                  <>
                    <Loader2
                      className="mr-2 h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                    Sending request…
                  </>
                ) : (
                  CAMPAIGN_NQ_CONFIG.primaryCta
                )}
              </button>

              <p className="text-left text-xs leading-5 text-slate-300">
                By selecting{" "}
                <span className="font-semibold text-white">
                  {CAMPAIGN_NQ_CONFIG.primaryCta}
                </span>
                , you request help taking the next step toward a contractor
                quote and authorize WindowMan to contact you by call, text
                message, or email about that request and related support. This
                service authorization does not include marketing. Message and
                data rates may apply. You acknowledge the{" "}
                <Link
                  to="/privacy"
                  className="font-medium text-sky-200 underline underline-offset-2 hover:text-sky-100"
                >
                  Privacy Policy
                </Link>{" "}
                and agree to the{" "}
                <Link
                  to="/terms"
                  className="font-medium text-sky-200 underline underline-offset-2 hover:text-sky-100"
                >
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
