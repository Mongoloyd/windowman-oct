/** Optional marketing consent — Truth Gate and aligned capture surfaces. */

const MARKETING_COPY =
  "Optional: I agree to receive promotional calls, emails, and text messages from WindowMan. Consent is not a condition of using the quote-review service. Message frequency varies. Message and data rates may apply. Reply STOP to opt out of marketing texts.";

type Props = {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Dark Truth Gate vs light modal */
  variant?: "dark" | "light";
};

export function MarketingConsentCheckbox({
  id = "marketing-consent",
  checked,
  onChange,
  variant = "dark",
}: Props) {
  const labelClass =
    variant === "dark"
      ? "flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-300"
      : "flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-muted-foreground";

  const inputClass =
    variant === "dark"
      ? "mt-0.5 h-4 w-4 flex-none cursor-pointer rounded border-white/20 bg-slate-950/70 text-cyan-400 accent-cyan-400"
      : "mt-0.5 h-4 w-4 flex-none cursor-pointer rounded border-border";

  return (
    <label htmlFor={id} className={labelClass}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={inputClass}
      />
      <span>{MARKETING_COPY}</span>
    </label>
  );
}

export default MarketingConsentCheckbox;
