import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import {
  isValidEmail,
  isValidFirstName,
  isValidZip,
} from "@/lib/nextdoor/attributionHelpers";
import type {
  NextdoorTrackCContact,
  NextdoorTrackCQualification,
} from "./types";
import { nextdoorPrimaryCtaClass } from "./nextdoorUi";

type NextdoorTrackCLeadCaptureProps = {
  onSaveContact: (contact: NextdoorTrackCContact) => Promise<void>;
  onSaveQualification: (qualification: NextdoorTrackCQualification) => Promise<void>;
  contactSaved: boolean;
  completed: boolean;
  isSubmittingContact?: boolean;
  isSubmittingQualification?: boolean;
  submitError?: string | null;
};

type ContactField = keyof NextdoorTrackCContact;

const inputBaseClass =
  "w-full rounded-lg border bg-gradient-to-b from-slate-50 to-white px-4 py-3 text-sm text-slate-900 shadow-[inset_0_2px_4px_rgba(15,40,90,0.06)] transition-[border-color,box-shadow] focus-visible:border-[#06b6d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4]/40";

const inputErrorClass =
  "border-amber-300/80 bg-amber-50/40 ring-2 ring-amber-200/50";

const cardShellClass =
  "mt-3 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_-3px_rgba(15,40,90,0.1),0_18px_44px_-22px_rgba(8,47,73,0.32)] backdrop-blur-sm md:p-6";

const WINDOW_TYPE_OPTIONS: Array<{ id: NextdoorTrackCQualification["windowType"]; label: string }> = [
  { id: "impact", label: "Impact windows" },
  { id: "standard", label: "Standard windows" },
  { id: "not_sure", label: "Not sure yet" },
];

const OPENING_COUNT_OPTIONS: Array<{
  id: NextdoorTrackCQualification["openingCountBucket"];
  label: string;
}> = [
  { id: "1_5", label: "1–5" },
  { id: "6_10", label: "6–10" },
  { id: "11_plus", label: "11+" },
];

const TIMELINE_OPTIONS: Array<{ id: NextdoorTrackCQualification["timeline"]; label: string }> = [
  { id: "asap", label: "ASAP" },
  { id: "1_3_months", label: "1–3 Months" },
  { id: "researching", label: "Researching" },
];

function isValidPhoneDigits(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 10;
}

function tileButtonClass(active: boolean): string {
  return [
    "rounded-xl border p-3 text-left transition-[border-color,box-shadow,transform] duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    active
      ? "border-2 border-primary/55 bg-primary/5 ring-2 ring-primary/20"
      : "border-slate-200/80 bg-white hover:-translate-y-0.5 hover:border-primary/35",
  ].join(" ");
}

type TileGroupProps<T extends string> = {
  legend: string;
  options: Array<{ id: T; label: string }>;
  value: T | null;
  onChange: (id: T) => void;
  error?: string;
  groupId: string;
  disabled?: boolean;
};

function TileGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
  groupId,
  disabled = false,
}: TileGroupProps<T>) {
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="mb-2 block text-sm font-semibold text-slate-800">{legend}</legend>
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              id={`${groupId}-${opt.id}`}
              onClick={() => onChange(opt.id)}
              aria-pressed={active}
              disabled={disabled}
              className={tileButtonClass(active)}
            >
              <span className="block text-sm font-bold leading-snug text-slate-900">{opt.label}</span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-amber-800" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

const CONSENT_COPY =
  "By saving this, you agree WindowMan may contact you about your window project. No quote upload is required.";

export function NextdoorTrackCLeadCapture({
  onSaveContact,
  onSaveQualification,
  contactSaved,
  completed,
  isSubmittingContact = false,
  isSubmittingQualification = false,
  submitError = null,
}: NextdoorTrackCLeadCaptureProps) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [contactErrors, setContactErrors] = useState<Partial<Record<ContactField, string>>>({});

  const [windowType, setWindowType] = useState<NextdoorTrackCQualification["windowType"] | null>(
    null,
  );
  const [openingCountBucket, setOpeningCountBucket] = useState<
    NextdoorTrackCQualification["openingCountBucket"] | null
  >(null);
  const [timeline, setTimeline] = useState<NextdoorTrackCQualification["timeline"] | null>(null);
  const [qualifyErrors, setQualifyErrors] = useState<
    Partial<Record<keyof NextdoorTrackCQualification, string>>
  >({});

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingContact) return;

    const nextErrors: Partial<Record<ContactField, string>> = {};
    if (!isValidFirstName(firstName.trim())) {
      nextErrors.firstName = "Enter at least 2 characters for your first name.";
    }
    if (!isValidEmail(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!isValidPhoneDigits(phone.trim())) {
      nextErrors.phone = "Enter a 10-digit phone number.";
    }
    if (!isValidZip(zip.trim())) {
      nextErrors.zip = "Enter a 5-digit ZIP code.";
    }

    setContactErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSaveContact({
      firstName: firstName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      zip: zip.trim(),
    });
  };

  const handleQualifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmittingQualification) return;

    const nextErrors: Partial<Record<keyof NextdoorTrackCQualification, string>> = {};
    if (!windowType) nextErrors.windowType = "Choose a window type.";
    if (!openingCountBucket) nextErrors.openingCountBucket = "Choose an opening count.";
    if (!timeline) nextErrors.timeline = "Choose a timeline.";

    setQualifyErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onSaveQualification({
      windowType: windowType as NextdoorTrackCQualification["windowType"],
      openingCountBucket: openingCountBucket as NextdoorTrackCQualification["openingCountBucket"],
      timeline: timeline as NextdoorTrackCQualification["timeline"],
    });
  };

  const contactFieldClass = (field: ContactField) =>
    [inputBaseClass, contactErrors[field] ? inputErrorClass : "border-slate-200/80"].join(" ");

  if (completed) {
    return (
      <div className={cardShellClass} role="status" aria-live="polite">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
            aria-hidden="true"
          >
            <Check className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
              Quote-check path saved
            </p>
            <h3 className="mt-2 font-display text-lg font-extrabold text-slate-900 md:text-xl">
              You&apos;re set.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              When you get an estimate, upload it here and WindowMan can review scope, permits,
              warranty, timing, and pricing before you sign.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (contactSaved) {
    return (
      <form className={cardShellClass} onSubmit={handleQualifySubmit} noValidate>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Step 2 of 2 · Quote prep
        </p>
        <h3 className="mt-2 font-display text-lg font-extrabold text-slate-900 md:text-xl">
          Help WindowMan prepare the right quote check.
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Choose one option in each group. Your details are saved — this just tailors your prep.
        </p>

        <div className="mt-5 space-y-5">
          <TileGroup
            groupId="track-c-window-type"
            legend="Window type"
            options={WINDOW_TYPE_OPTIONS}
            value={windowType}
            onChange={(id) => {
              setWindowType(id);
              setQualifyErrors((prev) => ({ ...prev, windowType: undefined }));
            }}
            error={qualifyErrors.windowType}
            disabled={isSubmittingQualification}
          />
          <TileGroup
            groupId="track-c-opening-count"
            legend="Opening count"
            options={OPENING_COUNT_OPTIONS}
            value={openingCountBucket}
            onChange={(id) => {
              setOpeningCountBucket(id);
              setQualifyErrors((prev) => ({ ...prev, openingCountBucket: undefined }));
            }}
            error={qualifyErrors.openingCountBucket}
            disabled={isSubmittingQualification}
          />
          <TileGroup
            groupId="track-c-timeline"
            legend="Timeline"
            options={TIMELINE_OPTIONS}
            value={timeline}
            onChange={(id) => {
              setTimeline(id);
              setQualifyErrors((prev) => ({ ...prev, timeline: undefined }));
            }}
            error={qualifyErrors.timeline}
            disabled={isSubmittingQualification}
          />
        </div>

        {submitError ? (
          <p className="mt-4 text-sm font-medium text-amber-800" role="alert">
            {submitError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmittingQualification}
          className={[nextdoorPrimaryCtaClass, "mt-5 w-full sm:w-auto"].join(" ")}
          style={{ padding: "13px 24px", fontSize: 14 }}
        >
          {isSubmittingQualification ? "Saving your quote-check path…" : "Save My Quote Check"}
        </button>
      </form>
    );
  }

  return (
    <form className={cardShellClass} onSubmit={handleContactSubmit} noValidate>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Save your quote-check path
      </p>
      <h3 className="mt-2 font-display text-lg font-extrabold text-slate-900 md:text-xl">
        Get ready before the contractor quote shows up.
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Tell WindowMan where to send your quote prep. When you get an estimate, you&apos;ll know what
        to check before you sign.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-800">First name</span>
          <input
            type="text"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              setContactErrors((prev) => ({ ...prev, firstName: undefined }));
            }}
            className={contactFieldClass("firstName")}
            placeholder="Jane"
          />
          {contactErrors.firstName ? (
            <span className="mt-1.5 block text-xs font-medium text-amber-800">
              {contactErrors.firstName}
            </span>
          ) : null}
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-slate-800">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setContactErrors((prev) => ({ ...prev, email: undefined }));
            }}
            className={contactFieldClass("email")}
            placeholder="you@example.com"
          />
          {contactErrors.email ? (
            <span className="mt-1.5 block text-xs font-medium text-amber-800">
              {contactErrors.email}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-800">Phone</span>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setContactErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            className={contactFieldClass("phone")}
            placeholder="(555) 555-5555"
          />
          {contactErrors.phone ? (
            <span className="mt-1.5 block text-xs font-medium text-amber-800">
              {contactErrors.phone}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-800">ZIP code</span>
          <input
            type="text"
            name="zip"
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
              setContactErrors((prev) => ({ ...prev, zip: undefined }));
            }}
            className={contactFieldClass("zip")}
            placeholder="33301"
          />
          {contactErrors.zip ? (
            <span className="mt-1.5 block text-xs font-medium text-amber-800">
              {contactErrors.zip}
            </span>
          ) : null}
        </label>
      </div>

      {submitError ? (
        <p className="mt-4 text-sm font-medium text-amber-800" role="alert">
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmittingContact}
        className={[nextdoorPrimaryCtaClass, "mt-4 w-full sm:w-auto"].join(" ")}
        style={{ padding: "13px 24px", fontSize: 14 }}
      >
        {isSubmittingContact ? "Saving your quote-check path…" : "Continue"}
      </button>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">{CONSENT_COPY}</p>
    </form>
  );
}
