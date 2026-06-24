import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  FileCheck2,
  ListChecks,
  Send,
  type LucideIcon,
} from "lucide-react";
import type {
  NextdoorTrackCContact,
  NextdoorTrackCQualification,
  QuoteReadiness,
} from "./types";
import {
  isValidEmail,
  isValidFirstName,
  isValidZip,
} from "@/lib/nextdoor/attributionHelpers";
import {
  formatPhoneDisplay,
  isValidUSPhone,
} from "@/utils/formatPhone";
import {
  nextdoorCardInteractiveClass,
  nextdoorEyebrowClass,
  nextdoorPrimaryCtaClass,
} from "./nextdoorUi";
import { NextdoorTrackCLeadCapture } from "./NextdoorTrackCLeadCapture";

const PREP_READINESS = new Set<QuoteReadiness>([
  "getting_quotes_now",
  "need_quote_soon",
  "researching",
]);

type TrackId = "quote_ready" | "quote_elsewhere" | "need_quote";

type IntentCard = {
  id: TrackId;
  title: string;
  copy: string;
  cta: string;
  icon: LucideIcon;
  /** Immediate readiness delegate, or null when inline expansion is required first. */
  readiness: QuoteReadiness | null;
};

const INTENT_CARDS: IntentCard[] = [
  {
    id: "quote_ready",
    title: "I have a quote ready",
    copy: "Upload your estimate for a private scan of vague terms, missing details, and pricing clarity.",
    cta: "Scan my quote",
    icon: FileCheck2,
    readiness: "has_estimate",
  },
  {
    id: "quote_elsewhere",
    title: "I have a quote, but not with me at the moment",
    copy: "Save your place and finish when your quote is handy.",
    cta: "Save & finish later",
    icon: Send,
    readiness: null,
  },
  {
    id: "need_quote",
    title: "I need a quote",
    copy: "Get prepared before contractors price the job — know what to ask and what to compare.",
    cta: "Get quote-ready",
    icon: ListChecks,
    readiness: null,
  },
];

export type NextdoorIntentRouterProps = {
  selected: QuoteReadiness | null;
  onReadinessSelect: (readiness: QuoteReadiness) => void;
  onLeadCaptureSubmit?: (data: {
    firstName: string;
    email: string;
    phone: string | null;
    zip: string | null;
    sourceIntent: "quote_elsewhere";
  }) => Promise<void> | void;
  leadCaptureSubmitting?: boolean;
  leadCaptureError?: string | null;
  /** After inline Track B save — collapse form and show quote-ready selection. */
  trackBLeadSaved?: boolean;
  /** Prefill Track B fields when opening (e.g. known-lead URL state). */
  prefillIdentity?: {
    firstName: string;
    email: string;
    zip: string;
  };
  /** Track C (need_quote) — parent-owned real lead ingestion handlers. */
  onTrackCSaveContact: (contact: NextdoorTrackCContact) => Promise<void>;
  onTrackCSaveQualification: (qualification: NextdoorTrackCQualification) => Promise<void>;
  trackCContactSaved?: boolean;
  trackCCompleted?: boolean;
  trackCContactSubmitting?: boolean;
  trackCQualifying?: boolean;
  trackCError?: string | null;
};

const inputBaseClass =
  "w-full rounded-lg border bg-gradient-to-b from-slate-50 to-white px-4 py-3 text-sm text-slate-900 shadow-[inset_0_2px_4px_rgba(15,40,90,0.06)] transition-[border-color,box-shadow] focus-visible:border-[#06b6d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4]/40";

export function NextdoorIntentRouter({
  selected,
  onReadinessSelect,
  onLeadCaptureSubmit,
  leadCaptureSubmitting = false,
  leadCaptureError = null,
  trackBLeadSaved = false,
  prefillIdentity,
  onTrackCSaveContact,
  onTrackCSaveQualification,
  trackCContactSaved = false,
  trackCCompleted = false,
  trackCContactSubmitting = false,
  trackCQualifying = false,
  trackCError = null,
}: NextdoorIntentRouterProps) {
  const [expandTrackB, setExpandTrackB] = useState(false);
  const [expandPrep, setExpandPrep] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [softHighlight, setSoftHighlight] = useState<{
    firstName?: boolean;
    email?: boolean;
    phone?: boolean;
    zip?: boolean;
  }>({});

  useEffect(() => {
    if (selected && PREP_READINESS.has(selected)) {
      setExpandPrep(true);
      setExpandTrackB(false);
    }
    if (selected === "has_estimate") {
      setExpandPrep(false);
    }
  }, [selected]);

  useEffect(() => {
    if (trackBLeadSaved) {
      setExpandTrackB(false);
    }
  }, [trackBLeadSaved]);

  const applyPrefillToTrackB = useCallback(() => {
    if (!prefillIdentity) return;
    setFirstName((prev) => prev || prefillIdentity.firstName);
    setEmail((prev) => prev || prefillIdentity.email);
    setZip((prev) => prev || prefillIdentity.zip);
  }, [prefillIdentity]);

  const handleIntentClick = useCallback(
    (card: IntentCard) => {
      if (card.id === "quote_elsewhere") {
        setExpandTrackB((open) => {
          const next = !open;
          if (next) applyPrefillToTrackB();
          return next;
        });
        setExpandPrep(false);
        return;
      }
      if (card.readiness === null) {
        setExpandPrep((open) => !open);
        setExpandTrackB(false);
        return;
      }
      setExpandTrackB(false);
      setExpandPrep(false);
      onReadinessSelect(card.readiness);
    },
    [applyPrefillToTrackB, onReadinessSelect],
  );

  const handleTrackBSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const nextHighlight: {
        firstName?: boolean;
        email?: boolean;
        phone?: boolean;
        zip?: boolean;
      } = {};
      if (!isValidFirstName(firstName)) nextHighlight.firstName = true;
      if (!isValidEmail(email)) nextHighlight.email = true;
      if (!isValidUSPhone(phone)) nextHighlight.phone = true;
      if (!isValidZip(zip.trim())) nextHighlight.zip = true;
      setSoftHighlight(nextHighlight);
      if (Object.keys(nextHighlight).length > 0) return;

      await onLeadCaptureSubmit?.({
        firstName: firstName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        zip: zip.trim(),
        sourceIntent: "quote_elsewhere",
      });
    },
    [email, firstName, onLeadCaptureSubmit, phone, zip],
  );

  return (
    <div className="w-full">
      <p className={nextdoorEyebrowClass}>Start where you are</p>
      <h2
        id="readiness-heading"
        className="mt-2 font-display text-2xl font-extrabold text-slate-900 md:text-3xl"
      >
        Where are you with your window quote?
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        Pick the option that fits today. Your quote stays private to you.
      </p>

      <div className="mt-6 grid gap-3.5">
        {INTENT_CARDS.map((card) => {
          const Icon = card.icon;
          const isTrackBOpen = card.id === "quote_elsewhere" && expandTrackB;
          const isPrepOpen = card.id === "need_quote" && expandPrep;
          const isQuoteReadySelected =
            selected === "has_estimate" && (!expandTrackB || trackBLeadSaved);
          const isSelected =
            (card.id === "quote_ready" && isQuoteReadySelected) ||
            (card.id === "need_quote" && (expandPrep || trackCCompleted));

          return (
            <div key={card.id}>
              <button
                type="button"
                onClick={() => handleIntentClick(card)}
                aria-pressed={
                  isSelected || isTrackBOpen || isPrepOpen ? true : undefined
                }
                aria-expanded={
                  card.id === "quote_elsewhere" || card.id === "need_quote"
                    ? card.id === "quote_elsewhere"
                      ? expandTrackB
                      : expandPrep
                    : undefined
                }
                className={[
                  nextdoorCardInteractiveClass,
                  "flex w-full items-start gap-3.5 p-5 text-left",
                  isSelected || isTrackBOpen || isPrepOpen
                    ? "-translate-y-0.5 border-2 border-primary/55 ring-2 ring-primary/25"
                    : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                    isSelected || isTrackBOpen || isPrepOpen
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/70 bg-muted/40 text-muted-foreground group-hover:text-primary",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-bold leading-snug text-slate-900 md:text-lg">
                    {card.title}
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-slate-600">
                    {card.copy}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    {card.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </span>

                {isSelected ? (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
                    aria-hidden="true"
                  >
                    <Check className="h-4 w-4" />
                  </span>
                ) : null}
              </button>

              {card.id === "quote_elsewhere" && expandTrackB ? (
                <form
                  onSubmit={handleTrackBSubmit}
                  className="mt-3 rounded-2xl border border-slate-200/80 bg-white/70 p-5 backdrop-blur-sm"
                  noValidate
                >
                  <p className="text-sm leading-relaxed text-slate-600">
                    Save your place. We&apos;ll keep this ready so you can upload from the device
                    that has your quote.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
                        First name
                      </span>
                      <input
                        type="text"
                        name="firstName"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          setSoftHighlight((prev) => ({ ...prev, firstName: false }));
                        }}
                        className={[
                          inputBaseClass,
                          softHighlight.firstName
                            ? "border-amber-300/80 bg-amber-50/40 ring-2 ring-amber-200/50"
                            : "border-slate-200/80",
                        ].join(" ")}
                        placeholder="First name"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
                        Email
                      </span>
                      <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setSoftHighlight((prev) => ({ ...prev, email: false }));
                        }}
                        className={[
                          inputBaseClass,
                          softHighlight.email
                            ? "border-amber-300/80 bg-amber-50/40 ring-2 ring-amber-200/50"
                            : "border-slate-200/80",
                        ].join(" ")}
                        placeholder="Email"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
                        Phone
                      </span>
                      <input
                        type="tel"
                        name="phone"
                        autoComplete="tel"
                        inputMode="tel"
                        maxLength={14}
                        value={phone}
                        onChange={(e) => {
                          setPhone(formatPhoneDisplay(e.target.value));
                          setSoftHighlight((prev) => ({ ...prev, phone: false }));
                        }}
                        className={[
                          inputBaseClass,
                          softHighlight.phone
                            ? "border-amber-300/80 bg-amber-50/40 ring-2 ring-amber-200/50"
                            : "border-slate-200/80",
                        ].join(" ")}
                        placeholder="Phone"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
                        ZIP code
                      </span>
                      <input
                        type="text"
                        name="zip"
                        autoComplete="postal-code"
                        inputMode="numeric"
                        maxLength={5}
                        value={zip}
                        onChange={(e) => {
                          setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
                          setSoftHighlight((prev) => ({ ...prev, zip: false }));
                        }}
                        className={[
                          inputBaseClass,
                          softHighlight.zip
                            ? "border-amber-300/80 bg-amber-50/40 ring-2 ring-amber-200/50"
                            : "border-slate-200/80",
                        ].join(" ")}
                        placeholder="ZIP code"
                      />
                    </label>
                  </div>
                  {leadCaptureError ? (
                    <p className="mt-3 text-sm text-amber-900" role="alert">
                      {leadCaptureError}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={leadCaptureSubmitting}
                    className={[nextdoorPrimaryCtaClass, "mt-4 w-full sm:w-auto"].join(" ")}
                    style={{ padding: "13px 24px", fontSize: 14 }}
                  >
                    {leadCaptureSubmitting ? "Saving…" : "Save my place"}
                  </button>
                </form>
              ) : null}

              {card.id === "need_quote" && expandPrep ? (
                <NextdoorTrackCLeadCapture
                  onSaveContact={onTrackCSaveContact}
                  onSaveQualification={onTrackCSaveQualification}
                  contactSaved={trackCContactSaved}
                  completed={trackCCompleted}
                  isSubmittingContact={trackCContactSubmitting}
                  isSubmittingQualification={trackCQualifying}
                  submitError={trackCError}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
