/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LeadStatusButton — RBAC-aware lead status update component
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trust-Centric Soft SaaS Design System
 * - Tactile, pressable button with gradient + shadow
 * - Clean state feedback (success/error badges)
 * - Hidden for users without write access
 */

import { useState } from "react";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  updateLeadStatus,
  getErrorMessage,
} from "@/services/adminDataService";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";

interface LeadStatusButtonProps {
  leadId: string;
  currentStatus: string;
  targetStatus: string;
  /** Label shown on the button */
  label?: string;
  /** Callback after successful update */
  onSuccess?: (newStatus: string) => void;
}

export function LeadStatusButton({
  leadId,
  currentStatus,
  targetStatus,
  label,
  onSuccess,
}: LeadStatusButtonProps) {
  const { hasWriteAccess } = useCurrentUserRole();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClick = async () => {
    if (!hasWriteAccess) {
      setErrorMsg(
        "You need operator or super admin access for this action."
      );
      setState("error");
      return;
    }

    setState("loading");
    setErrorMsg(null);

    try {
      const result = await updateLeadStatus(leadId, targetStatus);
      setState("success");
      onSuccess?.(targetStatus);

      // Reset after 2.5s
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      setState("error");
      setErrorMsg(getErrorMessage(err));
    }
  };

  // Don't render for viewers
  if (!hasWriteAccess) return null;

  const buttonLabel =
    label ||
    `Mark as ${targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1)}`;

  const isDisabled = state === "loading" || currentStatus === targetStatus;

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <Button
        onClick={handleClick}
        disabled={isDisabled}
        className={`
          rounded-xl text-sm font-semibold px-5 py-2.5
          transition-all duration-200 ease-out
          ${
            state === "success"
              ? "bg-emerald-50 text-emerald-950 border border-emerald-200 shadow-sm shadow-emerald-100/50 hover:bg-emerald-50"
              : state === "error"
                ? "bg-rose-50 text-red-950 border border-rose-200 shadow-sm shadow-rose-100/50 hover:bg-rose-50"
                : "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-md shadow-blue-200/50 hover:shadow-lg hover:shadow-blue-300/40 hover:from-blue-400 hover:to-blue-500 active:shadow-sm active:translate-y-px"
          }
          ${isDisabled && state === "idle" ? "opacity-40 cursor-not-allowed" : ""}
        `}
      >
        {state === "loading" && (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        )}
        {state === "success" && (
          <Check className="w-4 h-4 mr-2" />
        )}
        {state === "error" && (
          <AlertTriangle className="w-4 h-4 mr-2" />
        )}
        {state === "success" ? "Updated" : buttonLabel}
      </Button>

      {errorMsg && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1 max-w-[240px] leading-relaxed shadow-sm">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
