import { Link } from "react-router-dom";

type Props = {
  buttonLabel?: string;
  className?: string;
};

/** Service authorization copy shown beneath primary submit (Start Free, etc.). */
export function ServiceAuthorizationDisclosure({
  buttonLabel = "Start Free",
  className = "mt-3 text-center text-xs leading-5 text-slate-300",
}: Props) {
  return (
    <p className={className}>
      By selecting{" "}
      <span className="font-semibold text-slate-100">{buttonLabel}</span>, you
      request a WindowMan quote review and authorize WindowMan to contact you by
      call, text message, or email about verification, report delivery, account
      security, and related support. This authorization is limited to the
      service you requested and does not include marketing. Message and data
      rates may apply. You acknowledge the{" "}
      <Link
        to="/privacy"
        className="font-medium text-cyan-200 underline underline-offset-2 hover:text-cyan-100"
      >
        Privacy Policy
      </Link>{" "}
      and agree to the{" "}
      <Link
        to="/terms"
        className="font-medium text-cyan-200 underline underline-offset-2 hover:text-cyan-100"
      >
        Terms of Service
      </Link>
      .
    </p>
  );
}

export default ServiceAuthorizationDisclosure;
