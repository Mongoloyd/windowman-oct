import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import exitIntentImg from "@/assets/exit-intent-superhero.png";
import { pushLowIntentEvent } from "@/lib/tracking/dataLayer";

type ExitIntentMethod =
  | "desktop_chrome"
  | "fast_scroll_up"
  | "idle_after_interaction"
  | "history_back";

const INTERACTIVE_SELECTOR =
  'input, textarea, select, button[aria-expanded="true"], [contenteditable="true"]';

const CONTAINER_SELECTOR =
  "form, [role='dialog'], [aria-modal='true'], #otp-gate, #truth-gate";

const OPEN_MODAL_SELECTOR = "[role='dialog'][data-state='open'], [aria-modal='true']";

const WM_EXIT_SHOWN_KEY = "wm_exit_shown";

function isSessionExitShown(): boolean {
  try {
    return sessionStorage.getItem(WM_EXIT_SHOWN_KEY) === "true";
  } catch {
    return false;
  }
}

function isInteractionBlocking(): boolean {
  if (document.querySelector(OPEN_MODAL_SELECTOR)) {
    return true;
  }

  const active = document.activeElement;

  if (!active || active === document.body) {
    return false;
  }

  if (!(active instanceof HTMLElement)) {
    return false;
  }

  if (active.matches(INTERACTIVE_SELECTOR)) {
    return true;
  }

  if (active.closest(CONTAINER_SELECTOR)) {
    return true;
  }

  return false;
}

function canRegisterExitIntentListeners(
  suppressExitIntent: boolean,
  leadCaptured: boolean,
): boolean {
  if (suppressExitIntent) return false;
  if (leadCaptured) return false;
  if (isSessionExitShown()) return false;
  return true;
}

interface ExitIntentPhoneModalProps {
  suppressExitIntent?: boolean;
  stepsCompleted: number;
  flowMode: "A" | "B" | "C";
  leadCaptured: boolean;
  flowBLeadCaptured: boolean;
  county: string;
  answers: {
    windowCount: string | null;
    projectType: string | null;
    county: string | null;
    quoteStage: string | null;
    firstName: string | null;
    email: string | null;
    phone: string | null;
  };
  onClose: () => void;
  onCTAClick: () => void;
  onLeadSubmit?: (data: { email: string; phone: string }) => void;
  onReminderSet?: (data: { date: string; time: string }) => void;
}

const ExitIntentPhoneModal = ({
  suppressExitIntent = false,
  leadCaptured,
  onClose,
  onCTAClick,
}: ExitIntentPhoneModalProps) => {
  const [open, setOpen] = useState(false);
  const lastScrollY = useRef(window.scrollY);
  const lastScrollTime = useRef(Date.now());
  const hasScrolled = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest prop values in refs so `show` can read current state
  // without changing identity. A stable `show` prevents exit-intent effects
  // (notably the history effect) from tearing down and re-registering, which
  // would otherwise call history.pushState again on unrelated re-renders.
  const suppressExitIntentRef = useRef(suppressExitIntent);
  const leadCapturedRef = useRef(leadCaptured);
  suppressExitIntentRef.current = suppressExitIntent;
  leadCapturedRef.current = leadCaptured;

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  const show = useCallback((method: ExitIntentMethod) => {
    if (suppressExitIntentRef.current) return;
    if (leadCapturedRef.current || isSessionExitShown()) return;
    if (isInteractionBlocking()) return;
    try {
      sessionStorage.setItem(WM_EXIT_SHOWN_KEY, "true");
    } catch {
      /* sessionStorage unavailable */
    }
    pushLowIntentEvent("exit_intent", {
      exit_method: method,
      page_path: window.location.pathname,
    });
    setOpen(true);
  }, []);

  const listenersEligible = canRegisterExitIntentListeners(suppressExitIntent, leadCaptured);

  // Clear pending idle timer when exit intent becomes ineligible
  useEffect(() => {
    if (listenersEligible) return;
    clearIdleTimer();
  }, [listenersEligible, clearIdleTimer]);

  // Desktop trigger: mouseleave toward browser chrome
  useEffect(() => {
    if (!listenersEligible) return;

    const handleMouse = (e: MouseEvent) => {
      if (e.clientY < 20) show("desktop_chrome");
    };
    document.addEventListener("mouseleave", handleMouse);
    return () => {
      document.removeEventListener("mouseleave", handleMouse);
    };
  }, [show, listenersEligible]);

  // Mobile trigger 1: Fast scroll up (URL bar reach)
  useEffect(() => {
    if (!listenersEligible) return;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const currentTime = Date.now();
      const deltaY = lastScrollY.current - currentY; // positive = scrolling up
      const deltaT = currentTime - lastScrollTime.current;

      if (!hasScrolled.current && currentY > 0) {
        hasScrolled.current = true;
      }

      if (deltaY > 50 && deltaT < 300) {
        show("fast_scroll_up");
      }

      lastScrollY.current = currentY;
      lastScrollTime.current = currentTime;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [show, listenersEligible]);

  // Mobile trigger 2: Idle timer (15s after first scroll)
  useEffect(() => {
    if (!listenersEligible) return;

    const startIdleTimer = () => {
      clearIdleTimer();
      if (!hasScrolled.current) return;
      idleTimer.current = setTimeout(() => show("idle_after_interaction"), 15000);
    };

    const resetIdle = () => {
      if (!hasScrolled.current) hasScrolled.current = true;
      startIdleTimer();
    };

    window.addEventListener("scroll", resetIdle, { passive: true });
    window.addEventListener("touchstart", resetIdle, { passive: true });
    window.addEventListener("click", resetIdle);

    return () => {
      clearIdleTimer();
      window.removeEventListener("scroll", resetIdle);
      window.removeEventListener("touchstart", resetIdle);
      window.removeEventListener("click", resetIdle);
    };
  }, [show, listenersEligible, clearIdleTimer]);

  // Mobile trigger 3: Back button intercept
  useEffect(() => {
    if (!listenersEligible) return;

    history.pushState(null, "", location.href);
    const handlePopState = () => {
      const wasShown = isSessionExitShown();
      show("history_back");
      if (!wasShown && isSessionExitShown()) {
        history.pushState(null, "", location.href);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [show, listenersEligible]);

  const dismiss = () => {
    setOpen(false);
    onClose();
  };

  const handleCTA = () => {
    setOpen(false);
    onCTAClick();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9500] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) dismiss();
          }}
        >
          <div className="relative">
            <button
              onClick={dismiss}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg hover:bg-background transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <motion.img
              src={exitIntentImg}
              alt="Before you go — learn how WindowMan gets you the best window quotes"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="max-w-[min(90vw,420px)] max-h-[85vh] object-contain cursor-pointer rounded-lg"
              onClick={handleCTA}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExitIntentPhoneModal;
