export const CONTRACTOR_SHARING_AUTHORIZATION_COPY =
  "Optional: I authorize WindowMan to share my contact information, project details, and relevant quote specifications with selected partner contractors so they may contact me about competing quotes. WindowMan may receive a referral fee if I hire an introduced contractor. This does not authorize WindowMan to send my uploaded quote back to the contractor who issued it.";

type Props = {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function ContractorSharingConsentCheckbox({
  id = "contractor-sharing-consent",
  checked,
  onChange,
}: Props) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-foreground"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 flex-none cursor-pointer rounded border-border"
      />
      <span>{CONTRACTOR_SHARING_AUTHORIZATION_COPY}</span>
    </label>
  );
}
