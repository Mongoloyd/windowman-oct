import { handoffToCanonicalUpload, handoffToFirstQuotePath } from "./landingHandoff";

type LandingStickyCtaProps = {
  visible: boolean;
};

export default function LandingStickyCta({ visible }: LandingStickyCtaProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card p-3 md:hidden"
      style={{ boxShadow: "var(--shadow-shelf-up)" }}
      role="region"
      aria-label="Quick actions"
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <button
          type="button"
          onClick={() => handoffToCanonicalUpload()}
          className="btn-depth-primary min-h-[48px] flex-1"
          style={{ padding: "12px 16px", fontSize: 14 }}
        >
          Analyze My Quote
        </button>
        <button
          type="button"
          onClick={() => handoffToFirstQuotePath()}
          className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
          style={{ minHeight: 48, padding: "0 8px" }}
        >
          Need a quote?
        </button>
      </div>
    </div>
  );
}
