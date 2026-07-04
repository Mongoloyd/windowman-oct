// src/components/paid-search/TcpaPhoneConsentCheckbox.tsx
//
// TCPA express-written-consent checkbox for paid-search magnet forms.
//
// Compliance: unchecked by default (pre-checked consent is not valid TCPA
// express consent), separate affirmative action, complete consent language,
// consent-is-not-a-condition-of-purchase clause, and STOP opt-out disclosure.
//
// CRO: low visual weight, sits under the (optional) phone field. It only
// becomes consequential when a phone number is entered — the core email
// capture is never gated by it. See callers: consent is required only if a
// phone is present.

interface TcpaPhoneConsentCheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Validation message shown when a phone is entered but consent is unchecked. */
  error?: string;
}

export function TcpaPhoneConsentCheckbox({
  id = "tcpa-sms-consent",
  checked,
  onChange,
  error,
}: TcpaPhoneConsentCheckboxProps) {
  const errId = `${id}-err`;
  return (
    <div>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-2.5 text-[11px] leading-relaxed text-white/60"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errId : undefined}
          className="mt-0.5 h-4 w-4 flex-none cursor-pointer rounded border-white/25 bg-[#0B1728] text-[#49A5FF] accent-[#49A5FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#49A5FF]/40"
        />
        <span>
          I agree to receive automated marketing and follow-up text messages
          from WindowMan at the number provided. Consent is not a condition of
          any purchase. Msg &amp; data rates may apply. Reply STOP to opt out,
          HELP for help.
        </span>
      </label>
      {error && (
        <p id={errId} role="alert" className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default TcpaPhoneConsentCheckbox;
