import { useState, type FormEvent, type ReactNode } from "react";
import type { AreaContext } from "@/lib/nextdoor/areaContext";
import { zipFieldHelperText } from "@/lib/nextdoor/areaContext";
import {
  isValidEmail,
  isValidFirstName,
  isValidZip,
} from "@/lib/nextdoor/attributionHelpers";
import type { NextdoorIdentityFields, NextdoorPrefilledFields } from "./types";
import { nextdoorPrimaryCtaClass } from "./nextdoorUi";

type Props = {
  values: NextdoorIdentityFields;
  prefilled: NextdoorPrefilledFields;
  onChange: (field: keyof NextdoorIdentityFields, value: string) => void;
  onSubmit: () => void;
  submitted: boolean;
  submitting?: boolean;
  submitError?: string | null;
  successMessage?: string | null;
  optional?: boolean;
  readinessSelected: boolean;
  areaContext: AreaContext;
  /** Route-specific save label — stable for future backend wiring. */
  saveCtaLabel?: string;
  /** Contextual copy. "quote_ready" frames the save as the upload unlock moment. */
  variant?: "quote_ready" | "default";
};

type FieldKey = keyof NextdoorIdentityFields;

function ConfirmedFieldRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/25 bg-emerald-50/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-900">{value}</p>
        <p className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
          Confirmed from link
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:border-primary/40"
      >
        Edit
      </button>
    </div>
  );
}

export function NextdoorIdentityForm({
  values,
  prefilled,
  onChange,
  onSubmit,
  submitted,
  submitting = false,
  submitError = null,
  successMessage = null,
  optional = false,
  readinessSelected,
  areaContext,
  saveCtaLabel = "Save and continue",
  variant = "default",
}: Props) {
  const isQuoteReady = variant === "quote_ready";
  const [editing, setEditing] = useState<Record<FieldKey, boolean>>({
    firstName: !prefilled.firstName,
    email: !prefilled.email,
    zip: !prefilled.zip,
  });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const startEdit = (field: FieldKey) => {
    setEditing((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!readinessSelected) {
      setFormError("Choose where you are in the quote process above before continuing.");
      return;
    }

    const nextErrors: Partial<Record<FieldKey, string>> = {};

    if (!isValidFirstName(values.firstName)) {
      nextErrors.firstName = "Enter at least 2 characters for your first name.";
    }
    if (!isValidEmail(values.email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!isValidZip(values.zip)) {
      nextErrors.zip = "Enter a 5-digit Florida ZIP code.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit();
  };

  const renderField = (
    field: FieldKey,
    label: string,
    input: ReactNode,
    helper?: string,
  ) => {
    const showConfirmed = prefilled[field] && !editing[field] && values[field];

    return (
      <div className="block sm:col-span-2">
        {showConfirmed ? (
          <ConfirmedFieldRow label={label} value={values[field]} onEdit={() => startEdit(field)} />
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
            {input}
            {helper ? <span className="mt-1.5 block text-xs text-slate-500">{helper}</span> : null}
            {errors[field] ? (
              <span className="mt-1.5 block text-xs font-medium text-amber-800">{errors[field]}</span>
            ) : null}
          </label>
        )}
      </div>
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        "rounded-2xl border bg-gradient-to-b from-white to-slate-50/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_-3px_rgba(15,40,90,0.1),0_18px_44px_-22px_rgba(8,47,73,0.32)]",
        optional ? "border-dashed border-slate-300/80 p-5 md:p-6" : "border-white/80 p-6 md:p-8",
      ].join(" ")}
      noValidate
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {optional
              ? "Optional · save this checklist"
              : isQuoteReady
                ? "Save details to unlock upload"
                : "Save your quote-check path"}
          </p>
          <h2 className="mt-2 font-display text-xl font-extrabold text-slate-900 md:text-2xl">
            {optional
              ? "Want a copy of the checklist?"
              : isQuoteReady
                ? "Secure your place to upload"
                : "Want to keep your place?"}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            {optional
              ? "Save your place with name, email, and ZIP if you want a copy. Skip this if you are browsing only."
              : isQuoteReady
                ? "Your details are private. Save to unlock the upload zone."
                : "Save your place with name, email, and ZIP. You can upload when ready."}
          </p>
        </div>
        {optional ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
            Not required
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {renderField(
          "firstName",
          "First name",
          <input
            type="text"
            name="firstName"
            autoComplete="given-name"
            value={values.firstName}
            onChange={(e) => onChange("firstName", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3 text-sm text-slate-900 shadow-[inset_0_2px_4px_rgba(15,40,90,0.06)] transition-[border-color,box-shadow] focus-visible:border-[#06b6d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4]/40"
            placeholder="Jane"
          />,
        )}

        {renderField(
          "email",
          "Email",
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3 text-sm text-slate-900 shadow-[inset_0_2px_4px_rgba(15,40,90,0.06)] transition-[border-color,box-shadow] focus-visible:border-[#06b6d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4]/40"
            placeholder="you@example.com"
          />,
        )}

        {renderField(
          "zip",
          "ZIP code",
          <input
            type="text"
            name="zip"
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={5}
            value={values.zip}
            onChange={(e) => onChange("zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="w-full rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-3 text-sm text-slate-900 shadow-[inset_0_2px_4px_rgba(15,40,90,0.06)] transition-[border-color,box-shadow] focus-visible:border-[#06b6d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4]/40 sm:max-w-[12rem]"
            placeholder="33301"
          />,
          zipFieldHelperText(areaContext),
        )}
      </div>

      {submitError ? (
        <p className="mt-4 text-sm font-medium text-amber-800" role="alert">
          {submitError}
        </p>
      ) : null}

      {submitted && successMessage ? (
        <p
          className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-50/60 px-4 py-3 text-sm leading-relaxed text-emerald-900"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      {formError ? (
        <p className="mt-4 text-sm font-medium text-amber-800" role="alert">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || submitted}
        className={[
          nextdoorPrimaryCtaClass,
          "mt-5 w-full sm:w-auto",
          optional ? "opacity-90" : "",
        ].join(" ")}
        style={{ padding: "14px 28px", fontSize: 15 }}
      >
        {submitting
          ? "Saving…"
          : submitted
            ? "Saved"
            : optional
              ? `${saveCtaLabel} (optional)`
              : saveCtaLabel}
      </button>
    </form>
  );
}
