/**
 * ═══════════════════════════════════════════════════════════════════════════
 * QUOTE VIEWER BUTTON — Compact 1-click "View Quote" affordance
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Self-contained trigger that owns its own QuoteViewerModal state. Drop it into
 * a clickable table row, card, or action bar — it stops click propagation so it
 * never triggers row-to-dossier navigation.
 *
 * All quote access is delegated to QuoteViewerModal, which uses only the
 * role-gated admin-data `fetch_quote_evidence` action. This component never
 * touches storage or signed URLs directly.
 */

import { useRef, useState, type MouseEvent } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FileImage } from "lucide-react";
import { QuoteViewerModal } from "@/components/admin/QuoteViewerModal";

interface QuoteViewerButtonProps {
  leadId: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

export function QuoteViewerButton({
  leadId,
  label = "View Quote",
  variant = "outline",
  size = "sm",
  className,
}: QuoteViewerButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Guard against parent row/card navigation handlers.
    e.stopPropagation();
    setMounted(true);
    setOpen(true);
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        aria-label="View uploaded quote"
      >
        <FileImage className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </Button>
      {mounted ? (
        <QuoteViewerModal
          leadId={leadId}
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              window.setTimeout(() => triggerRef.current?.focus(), 0);
            }
          }}
        />
      ) : null}
    </>
  );
}
