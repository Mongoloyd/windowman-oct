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
import { useNavigate } from "react-router-dom";
import windowmanScript from "@/assets/windowman-script.png";
import { hasTrustedContactIdentity } from "@/lib/leadSession";
import { normalizeTruthGatePhoneToE164 } from "@/lib/validation/truthGateContact";
import { useScanFunnelSafe } from "@/state/scanFunnel";
import { WmChatConversation } from "./WmChatConversation";
import {
  buildWmChatContactDigest,
  getOrCreateWmChatContinuationSubmissionId,
  getOrCreateWmChatSessionId,
  getOrCreateWmChatSubmissionId,
  readWmChatCapturedContact,
  rotateWmChatCaptureIdentity,
  rotateWmChatContinuationSubmissionId,
  writeWmChatCapturedContact,
} from "./wmChatIdentity";
import { WmChatPostCaptureActionAvailability } from "./WmChatPostCaptureStage";
import {
  buildWmChatIntake,
  createWmChatInitialState,
  wmChatReducer,
} from "./wmChatReducer";
import { buildWmChatProjectBrief } from "./wmChatProjectBrief";
import {
  buildWmChatPostCaptureDraft,
  buildWmChatPostCaptureSubmission,
  fingerprintWmChatPostCaptureDraft,
} from "./wmChatPostCapturePayload";
import {
  clearWmChatResume,
  loadWmChatResume,
  saveWmChatResume,
} from "./wmChatResume";
import type {
  WmChatEmailSubmitter,
  WmChatPostCaptureSubmitter,
  WmChatResumeV1,
  WmChatSubmitter,
} from "./wmChatTypes";

const PowerToolFlow = lazy(() => import("@/components/PowerToolDemo"));

// Scheduling stays hidden until a durable operator fulfillment path exists.
const WMCHAT_SCHEDULE_CONVERSATION_VISIBLE = false;

type WmChatPageProps = {
  readonly submitter?: WmChatSubmitter;
  readonly emailSubmitter?: WmChatEmailSubmitter;
  readonly postCaptureSubmitter?: WmChatPostCaptureSubmitter;
  readonly thinkingDelayMs?: () => number;
};

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
  postCaptureSubmitter,
  thinkingDelayMs,
}: WmChatPageProps) {
  const [resumeCandidate] = useState(() => loadWmChatResume());
  const [state, dispatch] = useReducer(
    wmChatReducer,
    resumeCandidate,
    initializeWmChatState,
  );
  const [uploadHandoffReady, setUploadHandoffReady] = useState<string | null>(
    null,
  );
  const submittingRef = useRef(false);
  const continuationSubmittingRef = useRef(false);
  const continuationIdentityRef = useRef<{
    fingerprint: string;
    submissionId: string;
  } | null>(null);
  const preparedHandoffRef = useRef<string | null>(null);
  const completedHandoffRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>();
  const submissionIdRef = useRef<string>();
  const navigate = useNavigate();
  const funnel = useScanFunnelSafe();

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

    const scannerHandoffIsActive =
      state.status === "success" &&
      (state.captureMode === "quote_upload" ||
        state.postCaptureNodeId === "scanner_transition");

    if (!scannerHandoffIsActive) {
      console.warn("scanner_timer_orphaned_cleanup");
      if (preparedHandoffRef.current === uploadHandoffReady) {
        preparedHandoffRef.current = null;
      }
      setUploadHandoffReady(null);
      return;
    }

    const timer = window.setTimeout(() => {
      if (completedHandoffRef.current === uploadHandoffReady) return;
      completedHandoffRef.current = uploadHandoffReady;
      navigate("/?post_capture=upload&source=wmchat");
    }, 280);
    return () => window.clearTimeout(timer);
  }, [
    navigate,
    state.captureMode,
    state.postCaptureNodeId,
    state.status,
    uploadHandoffReady,
  ]);

  const hero = useMemo(
    () => (
      <div className="relative isolate mx-auto w-full max-w-[400px]">
        <div
          aria-hidden="true"
          className="absolute -inset-x-[6%] -top-8 bottom-[-4%] z-0 bg-[radial-gradient(ellipse_58%_100%_at_50%_0%,rgba(142,211,255,0.24)_0%,rgba(46,143,255,0.1)_46%,transparent_78%)] [clip-path:polygon(42%_0%,58%_0%,100%_100%,0%_100%)] [mask-image:linear-gradient(to_bottom,black_0%,rgba(0,0,0,0.78)_55%,transparent_100%)]"
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

  const projectBrief = useMemo(() => {
    if (
      state.currentNodeId !== "phone" ||
      state.captureMode !== "lead" ||
      !state.answers.need_reason
    ) {
      return null;
    }

    const intake = buildWmChatIntake(state);
    return intake ? buildWmChatProjectBrief(intake) : null;
  }, [state]);

  const prepareUploadHandoff = useCallback(
    (leadId: string, sessionId: string, phoneE164: string) => {
      if (!funnel || !hasTrustedContactIdentity(leadId, sessionId)) return;
      const handoffKey = `${leadId}:${sessionId}`;
      if (preparedHandoffRef.current === handoffKey) return;

      preparedHandoffRef.current = handoffKey;
      funnel.setPhone(phoneE164, "screened_valid");
      funnel.setLeadId(leadId);
      funnel.setSessionId(sessionId);
      setUploadHandoffReady(handoffKey);
    },
    [funnel],
  );

  useEffect(() => {
    if (
      state.status !== "success" ||
      state.postCaptureNodeId !== "scanner_transition" ||
      !state.leadId ||
      !state.sessionId
    ) {
      return;
    }

    const phoneE164 = normalizeTruthGatePhoneToE164(state.contact.phone);
    if (!phoneE164) return;
    prepareUploadHandoff(state.leadId, state.sessionId, phoneE164);
  }, [
    prepareUploadHandoff,
    state.contact.phone,
    state.leadId,
    state.postCaptureNodeId,
    state.sessionId,
    state.status,
  ]);

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
        code: "invalid_phone",
      });
      return;
    }

    submittingRef.current = true;
    dispatch({ type: "capture_started" });

    try {
      const activeSubmitter =
        submitter ??
        (await import("@/services/wmchatLeadCapture")).submitWmChatLead;
      const firstName = state.contact.firstName.trim() || null;
      const contactDigest = buildWmChatContactDigest(firstName, phoneE164);

      // The server binds one lead per session_id and rejects a later capture
      // carrying different contact details. Rotate up front when this tab has
      // already captured someone else, so the homeowner never sees that error.
      let activeSessionId = sessionId;
      let activeSubmissionId = submissionId;
      const capturedContact = readWmChatCapturedContact();
      if (capturedContact && capturedContact !== contactDigest) {
        const rotated = rotateWmChatCaptureIdentity();
        activeSessionId = rotated.sessionId;
        activeSubmissionId = rotated.submissionId;
        sessionIdRef.current = rotated.sessionId;
        submissionIdRef.current = rotated.submissionId;
      }

      const submitOnce = () =>
        activeSubmitter({
          sessionId: activeSessionId,
          submissionId: activeSubmissionId,
          firstName,
          phoneE164,
          serviceCommunicationsGranted: true,
          marketingConsentPresented: false,
          marketingCommunicationsGranted: false,
          wmchatIntake,
        });

      let result = await submitOnce();

      // Retrying the same session can never clear an ownership conflict, so
      // recover with one fresh identity instead of stranding the homeowner.
      if (!result.ok && result.code === "identity_conflict") {
        const rotated = rotateWmChatCaptureIdentity();
        activeSessionId = rotated.sessionId;
        activeSubmissionId = rotated.submissionId;
        sessionIdRef.current = rotated.sessionId;
        submissionIdRef.current = rotated.submissionId;
        result = await submitOnce();
      }

      if (!result.ok) {
        dispatch({
          type: "capture_failed",
          message: result.message,
          code: result.code,
        });
        return;
      }

      if (
        !hasTrustedContactIdentity(result.leadId, result.sessionId) ||
        result.sessionId !== activeSessionId
      ) {
        dispatch({
          type: "capture_failed",
          message: "That didn’t save safely. Please try again.",
          code: "capture_failed",
        });
        return;
      }

      writeWmChatCapturedContact(contactDigest);
      dispatch({
        type: "capture_succeeded",
        leadId: result.leadId,
        sessionId: result.sessionId,
      });
      clearWmChatResume();

      if (state.captureMode === "quote_upload") {
        prepareUploadHandoff(result.leadId, result.sessionId, phoneE164);
      }
    } catch {
      dispatch({
        type: "capture_failed",
        message: "That didn’t save safely. Please try again.",
        code: "capture_failed",
      });
    } finally {
      submittingRef.current = false;
    }
  }, [prepareUploadHandoff, state, submitter]);

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

  const handlePostCapturePersist = useCallback(async () => {
    if (
      continuationSubmittingRef.current ||
      state.continuationStatus === "submitting"
    ) {
      return;
    }

    const draft = buildWmChatPostCaptureDraft(state);
    let submissionId: string;
    try {
      const fingerprint = draft
        ? fingerprintWmChatPostCaptureDraft(draft)
        : "invalid-post-capture-draft";
      const existingIdentity = continuationIdentityRef.current;
      if (!existingIdentity) {
        submissionId = getOrCreateWmChatContinuationSubmissionId();
      } else if (existingIdentity.fingerprint === fingerprint) {
        submissionId = existingIdentity.submissionId;
      } else {
        submissionId = rotateWmChatContinuationSubmissionId();
      }
      continuationIdentityRef.current = { fingerprint, submissionId };
    } catch {
      return;
    }

    continuationSubmittingRef.current = true;
    dispatch({ type: "continuation_started", submissionId });

    try {
      const input = buildWmChatPostCaptureSubmission(state, submissionId);
      if (!input) {
        dispatch({
          type: "continuation_failed",
          submissionId,
          message: "Review this next step and try again.",
        });
        return;
      }

      const activeSubmitter =
        postCaptureSubmitter ??
        (await import("@/services/wmchatPostCapture"))
          .submitWmChatPostCapture;
      const result = await activeSubmitter(input);
      if (!result.ok) {
        dispatch({
          type: "continuation_failed",
          submissionId,
          message: result.message,
        });
        return;
      }

      if (
        !hasTrustedContactIdentity(result.leadId, result.sessionId) ||
        result.leadId !== input.leadId ||
        result.sessionId !== input.sessionId
      ) {
        dispatch({
          type: "continuation_failed",
          submissionId,
          message: "That next step did not save safely. Please try again.",
        });
        return;
      }

      dispatch({
        type: "continuation_succeeded",
        submissionId,
        leadId: result.leadId,
        sessionId: result.sessionId,
      });
    } catch {
      dispatch({
        type: "continuation_failed",
        submissionId,
        message: "That next step did not save safely. Please try again.",
      });
    } finally {
      continuationSubmittingRef.current = false;
    }
  }, [postCaptureSubmitter, state]);

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
          className="pointer-events-none fixed inset-0 [background-image:radial-gradient(circle_at_12%_30%,rgba(245,158,11,0.075)_0%,transparent_30%),radial-gradient(circle_at_88%_68%,rgba(46,143,255,0.13)_0%,transparent_34%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 opacity-[0.38] [background-image:linear-gradient(rgba(145,173,198,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(145,173,198,0.16)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_82%_66%_at_50%_28%,black_0%,rgba(0,0,0,0.76)_52%,transparent_88%)]"
        />
        <div className="relative z-10">
          <WmChatPostCaptureActionAvailability
            scheduleConversationVisible={WMCHAT_SCHEDULE_CONVERSATION_VISIBLE}
          >
            <WmChatConversation
              state={state}
              dispatch={dispatch}
              onSubmit={handleSubmit}
              onEmailSubmit={handleEmailSubmit}
              onPersistPostCapture={handlePostCapturePersist}
              hero={hero}
              projectBrief={projectBrief}
              thinkingDelayMs={thinkingDelayMs}
            />
          </WmChatPostCaptureActionAvailability>
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
