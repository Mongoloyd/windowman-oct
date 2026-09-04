import { useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyState = "idle" | "copied" | "error";

export function LeadIdentity({
  leadId,
  full = false,
  className = "",
}: {
  leadId: string;
  full?: boolean;
  className?: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const displayId = full ? leadId : `${leadId.slice(0, 8)}…`;

  const copyLeadId = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(leadId);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="min-w-0 break-all font-mono" title={leadId}>
        Lead ID: {displayId}
      </span>
      <button
        type="button"
        onClick={copyLeadId}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Copy lead ID ${leadId}`}
        title="Copy full lead ID"
      >
        {copyState === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      {copyState !== "idle" ? (
        <span className="sr-only" role={copyState === "error" ? "alert" : "status"} aria-live="polite">
          {copyState === "copied" ? "Lead ID copied" : "Could not copy lead ID"}
        </span>
      ) : null}
    </span>
  );
}
