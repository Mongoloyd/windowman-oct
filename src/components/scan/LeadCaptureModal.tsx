/**
 * LeadCaptureModal — Sprint 2.5 local prototype lead confirmation.
 *
 * UI progression only. No persistence, network, OTP, or authorization.
 */

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  demoPreview,
  EMPTY_LEAD_FORM,
  firstInvalidLeadField,
  formatLeadPhoneDisplay,
  validateLeadForm,
  type LeadFieldKey,
  type LeadFormValues,
  type LeadValidationErrors,
} from "./scanPrototypeModel";

type LeadCaptureModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmitValid: (values: LeadFormValues) => void;
};

type LeadFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
};

/** Reusable field shell — defined outside the modal function for stable identity. */
function LeadField({ id, label, required, error, children }: LeadFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[#0B2545]">
        {label}
        {required ? <span className="text-[#1878F0]"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function LeadCaptureModal({ open, onClose, onSubmitValid }: LeadCaptureModalProps) {
  const formId = useId();
  const [values, setValues] = useState<LeadFormValues>(EMPTY_LEAD_FORM);
  const [errors, setErrors] = useState<LeadValidationErrors>({});
  const fieldRefs = useRef<Partial<Record<LeadFieldKey, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!open) {
      setValues(EMPTY_LEAD_FORM);
      setErrors({});
    }
  }, [open]);

  function setField(key: LeadFieldKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateLeadForm(values);
    setErrors(nextErrors);

    const firstInvalid = firstInvalidLeadField(nextErrors);
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    onSubmitValid(values);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-lg border-slate-200 bg-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-[#0B2545] sm:text-2xl">
            YOUR QUOTE PREVIEW IS READY.
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Confirm where WindowMan should keep your review connected to you.
          </DialogDescription>
        </DialogHeader>

        <form id={formId} onSubmit={handleSubmit} className="mt-2 space-y-4" noValidate>
          <LeadField
            id={`${formId}-firstName`}
            label="First name"
            required
            error={errors.firstName}
          >
            <Input
              id={`${formId}-firstName`}
              ref={(node) => {
                fieldRefs.current.firstName = node;
              }}
              name="firstName"
              autoComplete="given-name"
              value={values.firstName}
              onChange={(event) => setField("firstName", event.target.value)}
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? `${formId}-firstName-error` : undefined}
              className="min-h-11"
            />
          </LeadField>

          <LeadField id={`${formId}-email`} label="Email" required error={errors.email}>
            <Input
              id={`${formId}-email`}
              ref={(node) => {
                fieldRefs.current.email = node;
              }}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${formId}-email-error` : undefined}
              className="min-h-11"
            />
          </LeadField>

          <LeadField id={`${formId}-phone`} label="Phone" required error={errors.phone}>
            <Input
              id={`${formId}-phone`}
              ref={(node) => {
                fieldRefs.current.phone = node;
              }}
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={values.phone}
              onChange={(event) => setField("phone", formatLeadPhoneDisplay(event.target.value))}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? `${formId}-phone-error` : undefined}
              className="min-h-11"
            />
          </LeadField>

          <details className="rounded-lg border border-dashed border-amber-300/80 bg-amber-50/40 px-3 py-2">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-amber-950">
              DEMO EXTRACTED DETAILS
            </summary>
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-[#0B2545]">Contractor:</span>{" "}
                {demoPreview.contractorName}
              </p>
              <p>
                <span className="font-semibold text-[#0B2545]">Opening scope:</span>{" "}
                {demoPreview.openingCountBucket}
              </p>
              <p className="text-xs text-slate-600">
                This demonstrates how scanner-proposed details will be confirmed later.
              </p>
            </div>
          </details>

          <button
            type="submit"
            className="
              group inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-6
              bg-gradient-to-r from-[#1878F0] to-[#1264D8]
              text-sm font-black tracking-[-0.01em] text-white sm:text-base
              border-t border-white/35 border-b-4 border-b-[#0B2545]
              shadow-[0_12px_28px_-10px_rgba(24,120,240,0.65)]
              transition-[transform,box-shadow,filter] duration-150
              hover:-translate-y-0.5 hover:brightness-105
              active:translate-y-1 active:border-b-0
              focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300
              motion-reduce:transition-none motion-reduce:hover:translate-y-0
            "
          >
            OPEN MY QUOTE PREVIEW
          </button>

          <p className="text-center text-xs text-slate-500">
            Nothing is submitted anywhere in this local prototype.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
