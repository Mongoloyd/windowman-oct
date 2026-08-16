import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Phone,
  RotateCcw,
} from "lucide-react";
import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isValidZipCode,
  normalizeZipCode,
} from "@/components/landing/firstQuoteIntakeTypes";
import {
  formatTruthGatePhoneDisplay,
  isValidTruthGatePhone,
} from "@/lib/validation/truthGateContact";
import { isValidEmail } from "@/utils/formatPhone";
import { getWmChatOption, resolveWmChatNode } from "./wmChatContent";
import { WmChatTrustCards } from "./WmChatTrustCards";
import type {
  WmChatAction,
  WmChatOption,
  WmChatOptionId,
  WmChatState,
} from "./wmChatTypes";

const WINDOWMAN_PHONE_DISPLAY = "(561) 468-5571";
const WINDOWMAN_PHONE_E164 = "+15614685571";
const randomThinkingDelayMs = () => Math.floor(Math.random() * 1000) + 500;

type WmChatConversationProps = {
  readonly state: WmChatState;
  readonly dispatch: Dispatch<WmChatAction>;
  readonly onSubmit: () => void;
  readonly onEmailSubmit: (email: string) => void;
  readonly hero: ReactNode;
  readonly thinkingDelayMs?: () => number;
};

type DelayedWmChatAction = Extract<
  WmChatAction,
  {
    type:
      | "select_single"
      | "continue_multi"
      | "continue_other"
      | "continue_contact"
      | "skip_name";
  }
>;

function WindowManBubble({
  text,
  live = false,
}: {
  readonly text: string;
  readonly live?: boolean;
}) {
  const surface = live
    ? "border-white/[0.11] border-t-white/[0.2] bg-[#111d2b] shadow-[0_20px_48px_rgba(0,0,0,0.34),0_10px_30px_rgba(46,143,255,0.07),inset_0_1px_0_rgba(255,255,255,0.13)]"
    : "border-[#223247] bg-[#121c29] shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.025)]";

  return (
    <div
      className={`max-w-[92%] rounded-[18px] rounded-bl-[5px] border px-4 py-3.5 text-[15px] leading-6 text-[#f4f8fc] sm:text-base ${surface}`}
      aria-live={live ? "polite" : undefined}
    >
      <p className="whitespace-pre-line">{text}</p>
    </div>
  );
}

function OptionButton({
  option,
  selected,
  equalWeight,
  onClick,
  disabled = false,
}: {
  readonly option: WmChatOption;
  readonly selected?: boolean;
  readonly equalWeight?: boolean;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  const emphasized = selected || (!equalWeight && option.tone === "primary");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`group flex min-h-14 w-full items-center gap-3 rounded-[17px] border px-4 py-3.5 text-left text-[15px] font-semibold leading-5 shadow-[0_12px_30px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.035)] transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070a0f] active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none sm:text-base ${
        emphasized
          ? "border-[#5bb0ff] bg-[#2e8fff] text-white shadow-[0_14px_34px_rgba(46,143,255,0.22),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-[#1a7beb] active:bg-[#1565c0]"
          : "border-white/[0.09] border-t-white/[0.14] bg-[#152235] text-[#f2f7fc] shadow-[0_14px_32px_rgba(0,0,0,0.28),0_5px_14px_rgba(46,143,255,0.035),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-[#4b79a5] hover:bg-[#192d45] hover:shadow-[0_18px_36px_rgba(0,0,0,0.3),0_7px_18px_rgba(46,143,255,0.07),inset_0_1px_0_rgba(255,255,255,0.11)]"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          emphasized ? "bg-white" : "bg-[#45627f] group-hover:bg-[#7ec6ff]"
        }`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        {option.label}
        {option.hint ? (
          <span className="mt-1 block text-xs font-normal text-[#91a7bc]">
            {option.hint}
          </span>
        ) : null}
      </span>
      {selected ? (
        <Check className="h-5 w-5 shrink-0 text-white" aria-hidden="true" />
      ) : (
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[#53708c] opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function VisitorBubble({ text }: { readonly text: string }) {
  return (
    <div className="ml-auto max-w-[84%] rounded-[19px] rounded-br-[5px] border border-[#67baff] bg-[#2e8fff] px-4 py-3 text-[15px] font-semibold leading-6 text-white shadow-[0_14px_34px_rgba(46,143,255,0.2),inset_0_1px_0_rgba(255,255,255,0.16)]">
      {text}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div
      role="status"
      aria-label="WindowMan is typing"
      className="flex min-h-12 w-fit items-center gap-1.5 rounded-[18px] rounded-bl-[5px] border border-[#263a52] bg-[#121c29] px-4 shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.025)]"
    >
      <span className="h-2 w-2 animate-bounce rounded-full bg-[#74bfff] [animation-delay:-0.3s] motion-reduce:animate-none" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[#74bfff] [animation-delay:-0.15s] motion-reduce:animate-none" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[#74bfff] motion-reduce:animate-none" />
      <span className="sr-only">WindowMan is thinking about your answer.</span>
    </div>
  );
}

function ContactShortcut() {
  const [copied, setCopied] = useState(false);

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(WINDOWMAN_PHONE_E164);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex justify-center">
      <a
        href={`tel:${WINDOWMAN_PHONE_E164}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-[#91cfff] hover:bg-[#111c29] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff] md:hidden"
      >
        <Phone className="h-4 w-4" aria-hidden="true" />
        Call WindowMan
      </a>
      <button
        type="button"
        onClick={copyNumber}
        className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-[#91cfff] hover:bg-[#111c29] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff] md:inline-flex"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Number copied" : `Talk to WindowMan · ${WINDOWMAN_PHONE_DISPLAY}`}
      </button>
    </div>
  );
}

export function WmChatConversation({
  state,
  dispatch,
  onSubmit,
  onEmailSubmit,
  hero,
  thinkingDelayMs = randomThinkingDelayMs,
}: WmChatConversationProps) {
  const node = resolveWmChatNode(state);
  const [selectedMulti, setSelectedMulti] = useState<readonly WmChatOptionId[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [pendingVisitorText, setPendingVisitorText] = useState<string | null>(null);
  const activeReplyRef = useRef<HTMLDivElement | null>(null);
  const thinkingRef = useRef<HTMLDivElement | null>(null);
  const successRef = useRef<HTMLElement | null>(null);
  const thinkingTimerRef = useRef<number | null>(null);
  const transitionPendingRef = useRef(false);

  useEffect(
    () => () => {
      if (thinkingTimerRef.current !== null) {
        window.clearTimeout(thinkingTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setSelectedMulti([]);
    setInputError(null);
    if (node.kind === "zip") setInputValue(state.contact.zip);
    else if (node.kind === "name") setInputValue(state.contact.firstName);
    else if (node.kind === "phone") setInputValue(state.contact.phone);
    else setInputValue("");
  }, [
    node.id,
    node.kind,
    state.contact.firstName,
    state.contact.phone,
    state.contact.zip,
  ]);

  const canGoBack =
    state.past.length > 0 &&
    state.status !== "submitting" &&
    !state.isThinking;
  const options = node.options ?? [];
  const limit = node.selectionLimit ?? 1;
  const isInitial = node.id === "entry" && state.history.length === 0;
  const phoneIsValid = isValidTruthGatePhone(state.contact.phone) && state.contact.phone.trim() !== "";
  const scrollTargetKey =
    state.status === "success"
      ? "success"
      : state.isThinking
        ? `thinking:${state.transcript.length}`
        : isInitial
          ? null
          : `reply:${node.id}:${state.transcript.length}`;

  useEffect(() => {
    if (!scrollTargetKey || typeof window === "undefined") return;

    const target =
      state.status === "success"
        ? successRef.current
        : state.isThinking
          ? thinkingRef.current
          : activeReplyRef.current;
    if (!target || typeof target.scrollIntoView !== "function") return;

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [scrollTargetKey, state.isThinking, state.status]);

  const supporting = useMemo(() => {
    if (node.kind === "multi") {
      return `${selectedMulti.length} of ${limit} selected`;
    }
    return node.supporting;
  }, [limit, node.kind, node.supporting, selectedMulti.length]);

  const queueTransition = (action: DelayedWmChatAction, visitorText: string) => {
    if (transitionPendingRef.current || state.isThinking) return;

    const requestedDelay = thinkingDelayMs();
    if (Number.isFinite(requestedDelay) && requestedDelay <= 0) {
      dispatch(action);
      return;
    }

    const delay = Number.isFinite(requestedDelay)
      ? Math.min(1500, Math.max(500, Math.floor(requestedDelay)))
      : 500;
    transitionPendingRef.current = true;
    setPendingVisitorText(visitorText);
    dispatch({ type: "thinking_started" });
    thinkingTimerRef.current = window.setTimeout(() => {
      dispatch({ type: "thinking_finished" });
      dispatch(action);
      transitionPendingRef.current = false;
      thinkingTimerRef.current = null;
      setPendingVisitorText(null);
    }, delay);
  };

  const selectSingle = (optionId: WmChatOptionId) => {
    const label = getWmChatOption(optionId)?.label ?? optionId;
    queueTransition(
      { type: "select_single", nodeId: node.id, optionId },
      label,
    );
  };

  const toggleMulti = (optionId: WmChatOptionId) => {
    setInputError(null);
    setSelectedMulti((current) => {
      if (current.includes(optionId)) return current.filter((id) => id !== optionId);
      if (optionId === "priority_not_sure") return [optionId];
      const withoutUnsure = current.filter((id) => id !== "priority_not_sure");
      if (withoutUnsure.length >= limit) return withoutUnsure;
      return [...withoutUnsure, optionId];
    });
  };

  const continueMulti = () => {
    if (selectedMulti.length === 0) {
      setInputError("Choose at least one answer.");
      return;
    }
    const visitorText = selectedMulti
      .map((optionId) => getWmChatOption(optionId)?.label ?? optionId)
      .join(" + ");
    queueTransition(
      { type: "continue_multi", nodeId: node.id, optionIds: selectedMulti },
      visitorText,
    );
  };

  const continueInput = (event: FormEvent) => {
    event.preventDefault();
    setInputError(null);

    if (node.kind === "zip") {
      if (!isValidZipCode(inputValue)) {
        setInputError("Enter a five-digit ZIP code.");
        return;
      }
      const zip = normalizeZipCode(inputValue);
      queueTransition(
        { type: "continue_contact", nodeId: "zip", value: zip },
        zip,
      );
      return;
    }

    if (node.kind === "name") {
      const name = inputValue.trim();
      if (!name) {
        queueTransition({ type: "skip_name" }, "Skip");
        return;
      }
      if (name.length < 2 || name.length > 60) {
        setInputError("Enter at least two letters, or choose Skip.");
        return;
      }
      queueTransition(
        { type: "continue_contact", nodeId: "first_name", value: name },
        name,
      );
      return;
    }

    if (node.kind === "email") {
      const email = inputValue.trim().toLowerCase();
      if (!email || email.length > 255 || !isValidEmail(email)) {
        setInputError("Enter a valid email address.");
        return;
      }
      onEmailSubmit(email);
      return;
    }

    if (node.kind === "other") {
      const value = inputValue.trim();
      if (!value || value.length > 160 || /[\r\n]/.test(value)) {
        setInputError("Use one short sentence, up to 160 characters.");
        return;
      }
      queueTransition(
        { type: "continue_other", nodeId: node.id, value },
        value,
      );
    }
  };

  const updatePhone = (value: string) => {
    const formatted = formatTruthGatePhoneDisplay(value);
    setInputValue(formatted);
    setInputError(null);
    dispatch({ type: "update_phone", value: formatted });
  };

  const submitPhone = (event: FormEvent) => {
    event.preventDefault();
    if (!phoneIsValid) {
      setInputError("Enter a valid US mobile number.");
      return;
    }
    onSubmit();
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[472px] flex-col px-[18px] pb-[calc(28px+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-5">
      <header
        data-testid="wmchat-floating-header"
        className="relative z-20 -mx-1 px-1 pt-2"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[15px] font-black tracking-[0.04em] text-white">
            WINDOW<span className="text-[#71c6ff]">MAN</span>
          </div>
          <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#8fd1ff] [text-shadow:0_1px_8px_rgba(46,143,255,0.25)]">
            Free for homeowners
          </span>
        </div>
        <p className="mx-auto mt-2 max-w-[34ch] text-center text-[11px] font-semibold tracking-[0.045em] text-[#afc4d5] [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
          AI quote intelligence for homeowner protection
        </p>
        <div
          aria-label="WindowMan service status"
          className="mt-2.5 flex items-center justify-between gap-3 text-[9px] font-bold uppercase tracking-[0.13em] text-[#6fa8cf] [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]"
        >
          <span>Independent software</span>
          <span>Private by design</span>
        </div>
      </header>

      <section className="pt-3 text-center">
        {hero}
        <p className="mt-1 text-[13px] font-medium tracking-[0.015em] text-[#79c8ff] sm:text-sm">
          WindowMan AI · Software, not a contractor
        </p>
        <h1 className="mt-3 text-balance text-2xl font-extrabold tracking-[-0.025em] text-white">
          WindowMan: Your Quote Hero
        </h1>
        <p className="mx-auto mt-2 max-w-[38ch] text-sm leading-6 text-[#9db0c3]">
          Tell me what brought you here. I’ll keep the next step simple.
        </p>
        {isInitial ? <WmChatTrustCards /> : null}
      </section>

      {!isInitial ? (
        <div className="mt-2 flex items-center justify-between border-b border-[#182638] pb-2">
          <div>
            <p className="text-sm font-semibold text-[#dce9f5]">WindowMan AI</p>
            <p className="text-xs text-[#7990a7]">Software, not a contractor</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => dispatch({ type: "back" })}
              disabled={!canGoBack}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#91a7bc] hover:bg-[#111c29] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "restart" })}
              disabled={state.status === "submitting" || state.isThinking}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#91a7bc] hover:bg-[#111c29] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Start over
            </button>
          </div>
        </div>
      ) : null}

      <main className={`flex-1 ${isInitial ? "mt-5" : "mt-4"}`}>
        {state.transcript.length ? (
          <div className="space-y-3 pb-3" aria-label="Conversation so far">
            {state.transcript.map((entry) =>
              entry.role === "windowman" ? (
                <WindowManBubble
                  key={entry.id}
                  text={entry.text}
                />
              ) : (
                <VisitorBubble key={entry.id} text={entry.text} />
              ),
            )}
          </div>
        ) : null}

        {state.status === "success" ? (
          <section
            ref={successRef}
            className="scroll-mb-[20vh] rounded-[20px] border border-white/[0.13] border-t-white/[0.24] bg-[#10243b] px-5 py-6 text-center shadow-[0_22px_60px_rgba(0,0,0,0.34),0_0_42px_rgba(46,143,255,0.14),inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-[#2e8fff]/45"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#67baff] bg-[#153f6b] text-[#9bd4ff]">
              <Check className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-white">
              {state.captureMode === "quote_upload"
                  ? "Now show me the quote."
                  : state.captureMode === "protection_kit"
                    ? "Protection Kit request received."
                  : "Project request received."}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#a8c2c5]">
              {state.captureMode === "quote_upload"
                  ? "PDF or clear photos. Private upload. No retyping."
                  : state.captureMode === "protection_kit"
                    ? "Your email and conversation were saved. Automated delivery is not active yet."
                  : "Your conversation was saved. WindowMan can continue from what you shared."}
            </p>
            {state.captureMode === "quote_upload" ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8dceff]">
                Project request received · Opening private upload
              </p>
            ) : null}
          </section>
        ) : (
          <div>
            <div ref={activeReplyRef} className="scroll-mb-[20vh]">
              <WindowManBubble
                text={node.prompt}
                live
              />
            </div>

            {supporting ? (
              <p className="mt-2 px-1 text-xs leading-5 text-[#7890a7]">{supporting}</p>
            ) : null}

            {state.isThinking && pendingVisitorText ? (
              <div ref={thinkingRef} className="mt-4 scroll-mb-[20vh] space-y-3">
                <VisitorBubble text={pendingVisitorText} />
                <ThinkingBubble />
              </div>
            ) : null}

            {!state.isThinking ? (
              <div className="mt-4 space-y-3">
                {node.kind === "single" ||
                node.kind === "recap" ||
                node.kind === "power" ||
                node.kind === "terminal"
                  ? options.map((option) => (
                      <OptionButton
                        key={option.id}
                        option={option}
                        equalWeight={node.id === "entry"}
                        onClick={() => selectSingle(option.id)}
                        disabled={state.isThinking}
                      />
                    ))
                  : null}

              {node.kind === "multi" ? (
                <>
                  {options.map((option) => (
                    <OptionButton
                      key={option.id}
                      option={option}
                      selected={selectedMulti.includes(option.id)}
                      onClick={() => toggleMulti(option.id)}
                      disabled={state.isThinking}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={continueMulti}
                    disabled={selectedMulti.length === 0}
                    className="flex min-h-14 w-full items-center justify-center rounded-[16px] border border-[#5bb0ff] bg-[#2e8fff] px-4 py-3.5 text-sm font-bold text-white shadow-[0_14px_32px_rgba(46,143,255,0.2),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-[#1a7beb] active:bg-[#1565c0] disabled:cursor-not-allowed disabled:border-[#26364a] disabled:bg-[#111b27] disabled:text-[#60758a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff]"
                  >
                    Keep going
                  </button>
                </>
              ) : null}

              {node.kind === "zip" ||
              node.kind === "name" ||
              node.kind === "other" ||
              node.kind === "email" ? (
                <form onSubmit={continueInput} noValidate className="space-y-3">
                  <label className="block text-sm font-semibold text-[#dbe7f2]" htmlFor={`wmchat-${node.id}`}>
                    {node.inputLabel}
                  </label>
                  {node.kind === "other" ? (
                    <textarea
                      id={`wmchat-${node.id}`}
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value.slice(0, 160))}
                      maxLength={160}
                      rows={3}
                      autoFocus
                      placeholder={node.inputPlaceholder}
                      className="w-full resize-none rounded-[15px] border border-[#2a3c50] bg-[#0f1824] px-4 py-3.5 text-base text-white outline-none placeholder:text-[#60758a] focus:border-[#2e8fff] focus:ring-2 focus:ring-[#2e8fff]/25"
                    />
                  ) : (
                    <input
                      id={`wmchat-${node.id}`}
                      type={node.kind === "email" ? "email" : "text"}
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      inputMode={
                        node.kind === "zip"
                          ? "numeric"
                          : node.kind === "email"
                            ? "email"
                            : "text"
                      }
                      autoComplete={
                        node.kind === "name"
                          ? "given-name"
                          : node.kind === "email"
                            ? "email"
                            : "postal-code"
                      }
                      maxLength={
                        node.kind === "zip" ? 5 : node.kind === "email" ? 255 : 60
                      }
                      autoFocus
                      placeholder={node.inputPlaceholder}
                      className="min-h-14 w-full rounded-[15px] border border-[#2a3c50] bg-[#0f1824] px-4 text-base text-white outline-none placeholder:text-[#60758a] focus:border-[#2e8fff] focus:ring-2 focus:ring-[#2e8fff]/25"
                    />
                  )}
                  {node.kind === "other" ? (
                    <p className="text-right text-xs text-[#6f879e]">{inputValue.length}/160</p>
                  ) : null}
                  {node.kind === "email" ? (
                    <p className="text-xs leading-5 text-[#9db0c3]">
                      By requesting the kit, you authorize WindowMan to email the
                      service information you asked for. This does not enroll you
                      in marketing messages.
                    </p>
                  ) : null}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {node.kind === "name" ? (
                      <button
                        type="button"
                        onClick={() => queueTransition({ type: "skip_name" }, "Skip")}
                        className="min-h-12 rounded-[14px] border border-[#38516b] bg-[#172435] px-4 text-sm font-semibold text-[#c7d5e2] shadow-[0_8px_20px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.03)] hover:border-[#587b9d] hover:bg-[#1b2c41] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff]"
                      >
                        Skip
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={state.status === "submitting"}
                      className={`min-h-12 rounded-[14px] border border-[#5bb0ff] bg-[#2e8fff] px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(46,143,255,0.18),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-[#1a7beb] active:bg-[#1565c0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff] ${
                        node.kind === "name" ? "" : "sm:col-span-2"
                      }`}
                    >
                      {state.status === "submitting"
                        ? "Saving securely…"
                        : node.kind === "email"
                          ? "Save my Protection Kit request"
                          : "Continue"}
                    </button>
                  </div>
                </form>
              ) : null}

              {node.kind === "phone" ? (
                <form onSubmit={submitPhone} noValidate className="space-y-3">
                  <label className="block text-sm font-semibold text-[#dbe7f2]" htmlFor="wmchat-phone">
                    Mobile number
                  </label>
                  <input
                    id="wmchat-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={inputValue}
                    onChange={(event) => updatePhone(event.target.value)}
                    autoFocus
                    placeholder="(561) 555-0123"
                    aria-invalid={inputError ? true : undefined}
                    aria-describedby="wmchat-service-disclosure wmchat-capture-error"
                    className="min-h-14 w-full rounded-[15px] border border-[#2a3c50] bg-[#0f1824] px-4 text-base text-white outline-none placeholder:text-[#60758a] focus:border-[#2e8fff] focus:ring-2 focus:ring-[#2e8fff]/25"
                  />
                  <p id="wmchat-service-disclosure" className="text-xs leading-5 text-[#9db0c3]">
                    By continuing, you authorize service texts and an automated WindowMan AI call about this request. Consent isn’t required to buy.
                  </p>
                  <button
                    type="submit"
                    disabled={state.status === "submitting"}
                    className="flex min-h-14 w-full items-center justify-center rounded-[16px] border border-[#5bb0ff] bg-[#2e8fff] px-4 text-sm font-bold text-white shadow-[0_14px_32px_rgba(46,143,255,0.2),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-[#1a7beb] active:bg-[#1565c0] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff]"
                  >
                    {state.status === "submitting"
                      ? "Saving securely…"
                      : state.captureMode === "quote_upload"
                        ? "Save & open private upload"
                        : "Save my project request"}
                  </button>
                </form>
              ) : null}

              {inputError || state.submitError ? (
                <p
                  id="wmchat-capture-error"
                  role="alert"
                  className="rounded-xl border border-[#81434b] bg-[#2a171d] px-3 py-2.5 text-sm text-[#ffbcc4]"
                >
                  {inputError ?? state.submitError}
                </p>
              ) : null}
              </div>
            ) : null}
          </div>
        )}
      </main>

      <div className="mt-7">
        <ContactShortcut />
      </div>

      <footer className="mt-6 border-t border-[#162334] pt-5 text-[11px] leading-[1.65] text-[#6f879e]">
        <p>
          {state.captureMode === "protection_kit"
            ? "By requesting the Protection Kit, you authorize WindowMan to email the service information you requested. This does not enroll you in marketing messages. See "
            : "By continuing, you authorize WindowMan to contact the mobile number you provided about this project using automated text messages and an artificial or prerecorded voice. Message and data rates may apply. Consent is not a condition of purchase. You may revoke consent at any time, including by replying STOP to a text or asking during a call. See "}
          <a href="/privacy" className="text-[#8fcdf8] underline-offset-2 hover:underline">Privacy</a>{" "}
          and{" "}
          <a href="/terms" className="text-[#8fcdf8] underline-offset-2 hover:underline">Terms</a>.
        </p>
        <p className="mt-3 text-[#536b82]">
          WindowMan provides software-guided quote support. It is not a contractor, insurer, law firm, or guarantee of price or savings.
        </p>
      </footer>
    </div>
  );
}
