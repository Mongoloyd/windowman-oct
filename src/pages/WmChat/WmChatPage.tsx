import { Helmet } from "react-helmet-async";
import {
  useCallback,
  useEffect,
  lazy,
  useMemo,
  useReducer,
  useRef,
  useState,
  Suspense,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import windowmanScript from "@/assets/windowman-script.png";
import { hasTrustedContactIdentity } from "@/lib/leadSession";
import { normalizeTruthGatePhoneToE164 } from "@/lib/validation/truthGateContact";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import { WmChatConversation } from "./WmChatConversation";
import {
  getOrCreateWmChatSessionId,
  getOrCreateWmChatSubmissionId,
} from "./wmChatIdentity";
import {
  buildWmChatIntake,
  createWmChatInitialState,
  wmChatReducer,
} from "./wmChatReducer";
import {
  clearWmChatResume,
  loadWmChatResume,
  saveWmChatResume,
} from "./wmChatResume";
import type {
  WmChatEmailSubmitter,
  WmChatResumeV1,
  WmChatSubmitter,
} from "./wmChatTypes";

const PowerToolFlow = lazy(() => import("@/components/PowerToolDemo"));

type WmChatPageProps = {
  readonly submitter?: WmChatSubmitter;
  readonly emailSubmitter?: WmChatEmailSubmitter;
  readonly thinkingDelayMs?: () => number;
};

function useWmChatSpeech() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        typeof window.SpeechSynthesisUtterance !== "undefined",
    );

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof window.SpeechSynthesisUtterance === "undefined"
    ) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(
      text.replace(/\s+/g, " ").trim(),
    );
    utterance.rate = 0.96;
    utterance.pitch = 0.94;
    window.speechSynthesis.speak(utterance);
  }, []);

  return { supported, speak };
}

function initializeWmChatState(snapshot: WmChatResumeV1 | null) {
  if (!snapshot) return createWmChatInitialState();
  return wmChatReducer(createWmChatInitialState(), {
    type: "restore",
    snapshot,
  });
}

export default function WmChatPage({
  submitter,
  emailSubmitter,
  thinkingDelayMs,
}: WmChatPageProps) {
  const [searchParams] = useSearchParams();
  const explicitResume =
    searchParams.has("r") || searchParams.has("resume_token");
  const [resumeCandidate] = useState(() =>
    explicitResume ? loadWmChatResume() : null,
  );
  const [state, dispatch] = useReducer(
    wmChatReducer,
    resumeCandidate,
    initializeWmChatState,
  );
  const [uploadHandoffReady, setUploadHandoffReady] = useState<string | null>(
    null,
  );
  const submittingRef = useRef(false);
  const preparedHandoffRef = useRef<string | null>(null);
  const completedHandoffRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>();
  const submissionIdRef = useRef<string>();
  const navigate = useNavigate();
  const funnel = useScanFunnelSafe();
  const speech = useWmChatSpeech();

  if (!sessionIdRef.current) sessionIdRef.current = getOrCreateWmChatSessionId();
  if (!submissionIdRef.current) {
    submissionIdRef.current = getOrCreateWmChatSubmissionId();
  }

  useEffect(() => {
    saveWmChatResume(state);
  }, [state]);

  useEffect(() => {
    const staticRobotsMeta = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="robots"]'),
    ).find((meta) => !meta.hasAttribute("data-rh"));
    if (!staticRobotsMeta) return;

    const previousContent = staticRobotsMeta.getAttribute("content");
    staticRobotsMeta.setAttribute("content", "noindex,nofollow");
    return () => {
      if (previousContent === null) staticRobotsMeta.removeAttribute("content");
      else staticRobotsMeta.setAttribute("content", previousContent);
    };
  }, []);

  useEffect(() => {
    if (!uploadHandoffReady) return;
    const timer = window.setTimeout(() => {
      if (completedHandoffRef.current === uploadHandoffReady) return;
      completedHandoffRef.current = uploadHandoffReady;
      navigate("/?post_capture=upload&source=wmchat");
    }, 280);
    return () => window.clearTimeout(timer);
  }, [navigate, uploadHandoffReady]);

  const hero = useMemo(
    () => (
      <div className="relative isolate mx-auto w-full max-w-[392px]">
        <div
          aria-hidden="true"
          className="absolute -inset-x-[14%] -top-8 bottom-[-4%] z-0 bg-[radial-gradient(ellipse_58%_100%_at_50%_0%,rgba(142,211,255,0.24)_0%,rgba(46,143,255,0.1)_46%,transparent_78%)] [clip-path:polygon(40%_0%,60%_0%,88%_100%,12%_100%)] [mask-image:linear-gradient(to_bottom,black_0%,rgba(0,0,0,0.78)_55%,transparent_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-[12%] bottom-[4%] top-[9%] z-0 rounded-full bg-[radial-gradient(circle,rgba(46,143,255,0.34)_0%,rgba(46,143,255,0.13)_44%,transparent_73%)] blur-2xl"
        />
        <img
          src={windowmanScript}
          width={1276}
          height={886}
          loading="eager"
          decoding="async"
          alt="WindowMan holding a project checklist"
          className="relative z-10 mx-auto h-auto max-h-[258px] w-full max-w-[372px] object-contain drop-shadow-[0_22px_28px_rgba(0,0,0,0.36)]"
        />
      </div>
    ),
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || state.status === "submitting") return;
    const phoneE164 = normalizeTruthGatePhoneToE164(state.contact.phone);
    const wmchatIntake = buildWmChatIntake(state);
    const sessionId = sessionIdRef.current;
    const submissionId = submissionIdRef.current;

    if (!phoneE164 || !wmchatIntake || !sessionId || !submissionId) {
      dispatch({ type: "capture_started" });
      dispatch({
        type: "capture_failed",
        message: "Check the mobile number and try again.",
      });
      return;
    }

    submittingRef.current = true;
    dispatch({ type: "capture_started" });

    try {
      const activeSubmitter =
        submitter ??
        (await import("@/services/wmchatLeadCapture")).submitWmChatLead;
      const result = await activeSubmitter({
        sessionId,
        submissionId,
        firstName: state.contact.firstName.trim() || null,
        phoneE164,
        serviceCommunicationsGranted: true,
        marketingConsentPresented: false,
        marketingCommunicationsGranted: false,
        wmchatIntake,
      });

      if (!result.ok) {
        dispatch({ type: "capture_failed", message: result.message });
        return;
      }

      if (
        !hasTrustedContactIdentity(result.leadId, result.sessionId) ||
        result.sessionId !== sessionId
      ) {
        dispatch({
          type: "capture_failed",
          message: "That didn’t save safely. Please try again.",
        });
        return;
      }

      dispatch({
        type: "capture_succeeded",
        leadId: result.leadId,
        sessionId: result.sessionId,
      });
      clearWmChatResume();

      if (
        state.captureMode === "quote_upload" &&
        funnel
      ) {
        const handoffKey = `${result.leadId}:${result.sessionId}`;
        if (preparedHandoffRef.current !== handoffKey) {
          preparedHandoffRef.current = handoffKey;
          funnel.setPhone(phoneE164, "screened_valid");
          funnel.setLeadId(result.leadId);
          funnel.setSessionId(result.sessionId);
          setUploadHandoffReady(handoffKey);
        }
      }
    } catch {
      dispatch({
        type: "capture_failed",
        message: "That didn’t save safely. Please try again.",
      });
    } finally {
      submittingRef.current = false;
    }
  }, [funnel, state, submitter]);

  const handleEmailSubmit = useCallback(
    async (email: string) => {
      if (submittingRef.current || state.status === "submitting") return;
      const wmchatIntake = buildWmChatIntake(state);
      if (!wmchatIntake || state.captureMode !== "protection_kit") {
        dispatch({ type: "capture_started" });
        dispatch({
          type: "capture_failed",
          message: "That request is incomplete. Please try again.",
        });
        return;
      }

      submittingRef.current = true;
      dispatch({ type: "capture_started" });

      try {
        const activeSubmitter =
          emailSubmitter ??
          (await import("@/services/wmchatEmailLeadCapture"))
            .submitWmChatEmailLead;
        const result = await activeSubmitter({ email, wmchatIntake });

        if (!result.ok) {
          dispatch({ type: "capture_failed", message: result.message });
          return;
        }
        if (!hasTrustedContactIdentity(result.leadId, result.sessionId)) {
          dispatch({
            type: "capture_failed",
            message: "That didn’t save safely. Please try again.",
          });
          return;
        }

        dispatch({
          type: "capture_succeeded",
          leadId: result.leadId,
          sessionId: result.sessionId,
        });
        clearWmChatResume();
      } catch {
        dispatch({
          type: "capture_failed",
          message: "That didn’t save safely. Please try again.",
        });
      } finally {
        submittingRef.current = false;
      }
    },
    [emailSubmitter, state],
  );

  return (
    <>
      <Helmet>
        <title>WindowMan: Your Quote Hero</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="theme-color" content="#070a0f" />
      </Helmet>
      <div className="relative min-h-[100dvh] overflow-x-clip bg-[#070a0f] font-sans text-white selection:bg-[#2e8fff] selection:text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_-10%,rgba(46,143,255,0.08),rgba(7,10,15,0)_72%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 [background-image:radial-gradient(circle_at_12%_30%,rgba(245,158,11,0.055)_0%,transparent_30%),radial-gradient(circle_at_88%_68%,rgba(46,143,255,0.09)_0%,transparent_34%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(145,173,198,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(145,173,198,0.16)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_82%_66%_at_50%_28%,black_0%,rgba(0,0,0,0.76)_52%,transparent_88%)]"
        />
        <div className="relative z-10">
          <WmChatConversation
            state={state}
            dispatch={dispatch}
            onSubmit={handleSubmit}
            onEmailSubmit={handleEmailSubmit}
            speechSupported={speech.supported}
            speak={speech.speak}
            hero={hero}
            thinkingDelayMs={thinkingDelayMs}
          />
          {state.currentNodeId === "demo_launch" ? (
            <Suspense fallback={null}>
              <PowerToolFlow
                triggerOpen
                entrySource="wm_chat"
                onToolClose={() => dispatch({ type: "back" })}
              />
            </Suspense>
          ) : null}
        </div>
      </div>
    </>
  );
}
