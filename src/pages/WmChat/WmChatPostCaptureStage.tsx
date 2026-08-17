import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  LockKeyhole,
} from "lucide-react";
import { type Dispatch, type FormEvent, type ReactNode, useState } from "react";

import { isCompleteWmChatPropertyAddress } from "./wmChatPostCapturePayload";
import type {
  WmChatAction,
  WmChatCallbackPreference,
  WmChatConversationTimePreference,
  WmChatPostCaptureAction,
  WmChatState,
} from "./wmChatTypes";

type WmChatPostCaptureStageProps = {
  readonly state: WmChatState;
  readonly dispatch: Dispatch<WmChatAction>;
  readonly onPersist: () => void;
};

const ACTION_LABELS: Record<WmChatPostCaptureAction, string> = {
  quote_request_game_plan: "Build my quote-request game plan",
  schedule_windowman_conversation: "Schedule a WindowMan conversation",
  review_quote_when_ready: "Review my quote when ready",
};

const TIME_LABELS: Record<WmChatConversationTimePreference, string> = {
  asap: "As soon as practical",
  weekday_morning: "Weekday morning",
  weekday_afternoon: "Weekday afternoon",
  weekday_evening: "Weekday evening",
};

const CALLBACK_LABELS: Record<WmChatCallbackPreference, string> = {
  next_week: "Check back next week",
  one_month: "Check back in about a month",
  three_months: "Check back in about three months",
  self_return: "I’ll return when I have the quote",
};

const primaryButton =
  "min-h-12 w-full rounded-[15px] border border-[#68b9ff] bg-[#2e8fff] px-4 py-3 text-sm font-extrabold text-white shadow-[0_16px_36px_rgba(46,143,255,0.24),inset_0_1px_0_rgba(255,255,255,0.2)] transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-[#1a7beb] active:translate-y-0 active:bg-[#1565c0] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#77c2ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08111c] motion-reduce:transform-none motion-reduce:transition-none";

const secondaryButton =
  "min-h-12 w-full rounded-[15px] border border-white/[0.1] border-t-white/[0.17] bg-[#162437] px-4 py-3 text-sm font-bold text-[#edf5fb] shadow-[0_14px_30px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[#4f7ea8] hover:bg-[#1b3048] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08111c] motion-reduce:transform-none motion-reduce:transition-none";

function StageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      data-testid="wmchat-post-capture-stage"
      className="scroll-mb-[20vh] overflow-hidden rounded-[22px] border border-white/[0.12] border-t-white/[0.22] bg-[#0d1927] shadow-[0_28px_70px_rgba(0,0,0,0.4),0_12px_38px_rgba(46,143,255,0.1),inset_0_1px_0_rgba(255,255,255,0.11)]"
    >
      <div className="border-b border-[#22384d] bg-[#102238] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#77c7ff]">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-xl font-black tracking-[-0.02em] text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#a9bfd2]">{description}</p>
      </div>
      <div className="space-y-3.5 px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}

function ActionCard({
  title,
  description,
  icon,
  primary = false,
  onClick,
}: {
  readonly title: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly primary?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-fast-lane={primary ? "true" : undefined}
      className={`group flex min-h-[92px] w-full items-start gap-3.5 rounded-[18px] border px-4 py-4 text-left transition-[border-color,background-color,transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e8fff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08111c] motion-reduce:transform-none motion-reduce:transition-none ${
        primary
          ? "border-[#58adf8] border-t-[#9bd4ff] bg-[linear-gradient(180deg,rgba(46,143,255,0.13),rgba(16,36,59,1))] shadow-[0_20px_44px_rgba(0,0,0,0.34),0_10px_30px_rgba(46,143,255,0.15),inset_0_1px_0_rgba(255,255,255,0.14)] hover:border-[#85c8ff]"
          : "border-white/[0.1] border-t-white/[0.17] bg-[#152235] shadow-[0_16px_36px_rgba(0,0,0,0.3),0_7px_20px_rgba(46,143,255,0.045),inset_0_1px_0_rgba(255,255,255,0.09)] hover:border-[#4d7ba5] hover:bg-[#192e46]"
      }`}
    >
      <span
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border ${
          primary
            ? "border-[#69baff] bg-[#173f67] text-[#9bd5ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_18px_rgba(46,143,255,0.14)]"
            : "border-[#38536e] bg-[#101d2c] text-[#8bbfe4] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold leading-5 text-white">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[#96adc1]">
          {description}
        </span>
      </span>
    </button>
  );
}

function ChoiceStage({
  dispatch,
}: {
  readonly dispatch: Dispatch<WmChatAction>;
}) {
  const select = (postCaptureAction: WmChatPostCaptureAction) =>
    dispatch({ type: "select_post_capture_action", postCaptureAction });

  return (
    <StageShell
      eyebrow="Request safely received"
      title="Your project request is saved."
      description="What would help you most next?"
    >
      <ActionCard
        primary
        icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
        title="Build my quote-request game plan"
        description="Turn what you shared into a cleaner request checklist."
        onClick={() => select("quote_request_game_plan")}
      />
      <ActionCard
        icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
        title="Schedule a WindowMan conversation"
        description="Choose a preferred callback window. We’ll confirm it separately."
        onClick={() => select("schedule_windowman_conversation")}
      />
      <ActionCard
        icon={<FileSearch className="h-5 w-5" aria-hidden="true" />}
        title="Review my quote when ready"
        description="Open the secure scanner now or choose when to continue."
        onClick={() => select("review_quote_when_ready")}
      />
    </StageShell>
  );
}

function AddressStage({
  state,
  dispatch,
}: {
  readonly state: WmChatState;
  readonly dispatch: Dispatch<WmChatAction>;
}) {
  const [error, setError] = useState<string | null>(null);
  const update = (field: keyof WmChatState["propertyAddressDraft"], value: string) => {
    setError(null);
    dispatch({ type: "update_property_address", field, value });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isCompleteWmChatPropertyAddress(state.propertyAddressDraft)) {
      setError("Enter the street, city, state, and five-digit ZIP—or choose Skip.");
      return;
    }
    dispatch({ type: "continue_property_address" });
  };

  return (
    <StageShell
      eyebrow="Optional location context"
      title="Where is this project?"
      description="Optional — add it so your game plan can include the right local pricing and permit questions."
    >
      <form onSubmit={submit} noValidate className="space-y-3">
        <label className="block text-xs font-bold text-[#c9d9e6]" htmlFor="wmchat-address-line1">
          Street address
        </label>
        <input
          id="wmchat-address-line1"
          autoComplete="address-line1"
          value={state.propertyAddressDraft.line1}
          onChange={(event) => update("line1", event.target.value.slice(0, 120))}
          className="min-h-12 w-full rounded-[14px] border border-[#314860] bg-[#101b2a] px-4 text-base text-white outline-none placeholder:text-[#647d94] focus:border-[#5aaff9] focus:ring-2 focus:ring-[#2e8fff]/25"
          placeholder="123 Main Street"
        />
        <input
          aria-label="Apartment or unit"
          autoComplete="address-line2"
          value={state.propertyAddressDraft.line2}
          onChange={(event) => update("line2", event.target.value.slice(0, 120))}
          className="min-h-12 w-full rounded-[14px] border border-[#314860] bg-[#101b2a] px-4 text-base text-white outline-none placeholder:text-[#647d94] focus:border-[#5aaff9] focus:ring-2 focus:ring-[#2e8fff]/25"
          placeholder="Apartment or unit (optional)"
        />
        <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-[1fr_92px]">
          <input
            aria-label="City"
            autoComplete="address-level2"
            value={state.propertyAddressDraft.city}
            onChange={(event) => update("city", event.target.value.slice(0, 80))}
            className="min-h-12 w-full rounded-[14px] border border-[#314860] bg-[#101b2a] px-4 text-base text-white outline-none placeholder:text-[#647d94] focus:border-[#5aaff9] focus:ring-2 focus:ring-[#2e8fff]/25"
            placeholder="City"
          />
          <input
            aria-label="State"
            autoComplete="address-level1"
            value={state.propertyAddressDraft.region}
            onChange={(event) => update("region", event.target.value.slice(0, 40))}
            className="min-h-12 w-full rounded-[14px] border border-[#314860] bg-[#101b2a] px-4 text-base uppercase text-white outline-none placeholder:text-[#647d94] focus:border-[#5aaff9] focus:ring-2 focus:ring-[#2e8fff]/25"
            placeholder="State"
          />
        </div>
        <input
          aria-label="Project ZIP code"
          autoComplete="postal-code"
          inputMode="numeric"
          value={state.propertyAddressDraft.postalCode}
          onChange={(event) => update("postalCode", event.target.value.replace(/\D/g, "").slice(0, 5))}
          className="min-h-12 w-full rounded-[14px] border border-[#314860] bg-[#101b2a] px-4 text-base text-white outline-none placeholder:text-[#647d94] focus:border-[#5aaff9] focus:ring-2 focus:ring-[#2e8fff]/25"
          placeholder="ZIP code"
        />
        {error ? (
          <p role="alert" className="rounded-xl border border-[#81434b] bg-[#2a171d] px-3 py-2.5 text-sm text-[#ffbcc4]">
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => dispatch({ type: "skip_property_address" })}
            className={secondaryButton}
          >
            Skip this step
          </button>
          <button type="submit" className={primaryButton}>
            Add to my game plan
          </button>
        </div>
        <p className="flex items-start gap-2 text-[11px] leading-5 text-[#758da3]">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Your address stays out of the local resume record and is sent only when you save this next step.
        </p>
      </form>
    </StageShell>
  );
}

function TapChoice({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={secondaryButton}>
      {label}
    </button>
  );
}

function ReviewStage({ state, onPersist }: { readonly state: WmChatState; readonly onPersist: () => void }) {
  const action = state.postCaptureAction;
  if (!action) return null;
  const address = state.propertyAddressDecision === "add" ? state.propertyAddressDraft : null;

  return (
    <StageShell
      eyebrow="Review your next step"
      title={ACTION_LABELS[action]}
      description="Confirm this request before WindowMan saves the continuation."
    >
      <div className="space-y-3 rounded-[16px] border border-[#2e4964] border-t-white/[0.14] bg-[#111f30] px-4 py-4 text-sm leading-6 text-[#d8e6f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_30px_rgba(0,0,0,0.24)]">
        {state.conversationTimePreference ? (
          <p><span className="font-bold text-white">Preferred time:</span> {TIME_LABELS[state.conversationTimePreference]}</p>
        ) : null}
        {state.callbackPreference ? (
          <p><span className="font-bold text-white">Continue later:</span> {CALLBACK_LABELS[state.callbackPreference]}</p>
        ) : null}
        {action !== "review_quote_when_ready" ? (
          <p>
            <span className="font-bold text-white">Project address:</span>{" "}
            {address
              ? `${address.line1}, ${address.city}, ${address.region} ${address.postalCode}`
              : "Skipped"}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onPersist}
        disabled={state.continuationStatus === "submitting"}
        className={primaryButton}
      >
        {state.continuationStatus === "submitting" ? "Saving securely…" : "Confirm this next step"}
      </button>
      {state.continuationError ? (
        <p role="alert" className="rounded-xl border border-[#81434b] bg-[#2a171d] px-3 py-2.5 text-sm text-[#ffbcc4]">
          {state.continuationError}
        </p>
      ) : null}
    </StageShell>
  );
}

function ConfirmationStage({ state }: { readonly state: WmChatState }) {
  const scheduled = state.postCaptureAction === "schedule_windowman_conversation";
  const reminder = state.postCaptureAction === "review_quote_when_ready";
  return (
    <StageShell
      eyebrow="Next step recorded"
      title={
        scheduled
          ? "Conversation request received."
          : reminder
            ? "Quote-review preference saved."
            : "Game-plan request received."
      }
      description={
        scheduled
          ? "You selected a preferred callback window. This is a request, not a confirmed appointment."
          : reminder
            ? "WindowMan saved when you want to continue with your quote."
            : "WindowMan saved the project context needed to continue building your request plan."
      }
    >
      <div className="flex items-center gap-3 rounded-[16px] border border-[#3975a4] border-t-[#83c8ff] bg-[#112b45] px-4 py-4 shadow-[0_16px_34px_rgba(0,0,0,0.28),0_8px_24px_rgba(46,143,255,0.12),inset_0_1px_0_rgba(255,255,255,0.12)]">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-[#8fd0ff]" aria-hidden="true" />
        <p className="text-sm font-semibold leading-5 text-white">Your original project request remains safely preserved.</p>
      </div>
    </StageShell>
  );
}

export function WmChatPostCaptureStage({
  state,
  dispatch,
  onPersist,
}: WmChatPostCaptureStageProps) {
  switch (state.postCaptureNodeId) {
    case "choice":
      return <ChoiceStage dispatch={dispatch} />;
    case "conversation_time":
      return (
        <StageShell
          eyebrow="Callback preference"
          title="When would a WindowMan conversation be most useful?"
          description="Choose a preferred window. We’ll treat it as a request until it is confirmed."
        >
          {(Object.keys(TIME_LABELS) as WmChatConversationTimePreference[]).map((value) => (
            <TapChoice
              key={value}
              label={TIME_LABELS[value]}
              onClick={() => dispatch({ type: "select_conversation_time", value })}
            />
          ))}
        </StageShell>
      );
    case "address":
      return <AddressStage state={state} dispatch={dispatch} />;
    case "quote_readiness":
      return (
        <StageShell
          eyebrow="Secure quote review"
          title="Do you have the written quote now?"
          description="If you do, WindowMan can open the existing private scanner without asking for your address."
        >
          <button
            type="button"
            onClick={() => dispatch({ type: "select_quote_readiness", value: "ready_now" })}
            className={primaryButton}
          >
            Yes — open my secure scanner
          </button>
          <TapChoice
            label="Not yet — choose when to continue"
            onClick={() => dispatch({ type: "select_quote_readiness", value: "not_yet" })}
          />
        </StageShell>
      );
    case "callback_preference":
      return (
        <StageShell
          eyebrow="Continue on your timing"
          title="When should WindowMan pick this back up?"
          description="Choose a preference without scheduling an appointment."
        >
          {(Object.keys(CALLBACK_LABELS) as WmChatCallbackPreference[]).map((value) => (
            <TapChoice
              key={value}
              label={CALLBACK_LABELS[value]}
              onClick={() => dispatch({ type: "select_callback_preference", value })}
            />
          ))}
        </StageShell>
      );
    case "review":
      return <ReviewStage state={state} onPersist={onPersist} />;
    case "scanner_transition":
      return (
        <StageShell
          eyebrow="Private handoff"
          title="Opening your secure quote scanner."
          description="Your project identity is being carried forward. No contact re-entry is required."
        >
          <div className="flex items-center gap-3 rounded-[16px] border border-[#735bd2] border-t-[#b5a9ff] bg-[#231c45] px-4 py-4 text-sm font-semibold text-[#eeeaff] shadow-[0_18px_38px_rgba(0,0,0,0.3),0_8px_26px_rgba(107,78,220,0.15),inset_0_1px_0_rgba(255,255,255,0.12)]">
            <FileSearch className="h-5 w-5 shrink-0" aria-hidden="true" />
            PDF or clear photos. Private upload. No retyping.
          </div>
        </StageShell>
      );
    case "confirmation":
      return <ConfirmationStage state={state} />;
    default:
      return null;
  }
}
