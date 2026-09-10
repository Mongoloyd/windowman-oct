import { useRef, type ReactNode, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { MotionConfig } from "framer-motion";
import { SAMPLE_QUOTE, VARIANT_TITLES } from "./fixture";
import type { SyntheticDemoVariant } from "./types";

interface SyntheticDemoDialogProps {
  open: boolean;
  variant: SyntheticDemoVariant;
  onOpenChange: (open: boolean) => void;
  onAfterClose?: () => void;
  openerRef?: RefObject<HTMLElement>;
  previewLabel?: string;
  children: ReactNode;
}
export default function SyntheticDemoDialog({ open, variant, onOpenChange, onAfterClose, openerRef, previewLabel, children }: SyntheticDemoDialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const fallbackOpener = useRef(typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sd-overlay" />
        <Dialog.Content
          className={`sd-dialog sd-${variant}`}
          data-synthetic-demo={variant}
          onOpenAutoFocus={(event) => { event.preventDefault(); titleRef.current?.focus(); }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const opener = openerRef?.current ?? fallbackOpener.current;
            if (opener?.isConnected) opener.focus({ preventScroll: true });
            onAfterClose?.();
          }}
        >
          <MotionConfig reducedMotion="user">
            {previewLabel ? <p className="sd-qa-label">{previewLabel}</p> : null}
            <header className="sd-header">
              <div className="sd-brand" aria-label="WindowMan">
                <img src="/images/synthetic-demo/brand-mark.png" width={34} height={34} alt="" />
                <div><span>Window<span>Man</span></span>
                  <small>CLEARER QUOTES. BRIGHTER HOMES.</small></div>
              </div>
              <Dialog.Close className="sd-close" aria-label="Close sample demo"><X aria-hidden="true" size={22} /></Dialog.Close>
            </header>
            <Dialog.Title ref={titleRef} tabIndex={-1} className="sd-visually-hidden">{VARIANT_TITLES[variant]}</Dialog.Title>
            <Dialog.Description className="sd-visually-hidden">{SAMPLE_QUOTE.disclosure} Explore three details, then choose your next step.</Dialog.Description>
            {children}
            <p className="sd-disclosure">{SAMPLE_QUOTE.disclosure}</p>
            <footer className="sd-footer">BETTER QUESTIONS. BRIGHTER HOMES.</footer>
          </MotionConfig>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
