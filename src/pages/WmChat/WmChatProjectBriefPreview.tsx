import { ClipboardCheck, ListChecks, MessageCircleQuestion } from "lucide-react";

import type { WmChatProjectBrief } from "./wmChatProjectBrief";

type WmChatProjectBriefPreviewProps = {
  readonly brief: WmChatProjectBrief;
};

export function WmChatProjectBriefPreview({
  brief,
}: WmChatProjectBriefPreviewProps) {
  const scopeChecklist = brief.estimateRequirements.slice(0, 3);
  const keyQuestion = brief.contractorQuestions[brief.contractorQuestions.length - 1];

  return (
    <section
      aria-labelledby="wmchat-project-brief-title"
      data-testid="wmchat-project-brief-preview"
      className="mb-4 overflow-hidden rounded-[20px] border border-[#4a89bd]/55 border-t-white/[0.2] bg-[#0e1b2a] shadow-[0_22px_54px_rgba(0,0,0,0.34),0_10px_34px_rgba(46,143,255,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]"
    >
      <div className="border-b border-[#243a50] bg-[#12273d] px-4 py-3.5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#76c4ff]">
          Your first-quote game plan
        </p>
        <h2
          id="wmchat-project-brief-title"
          className="mt-1 text-lg font-extrabold tracking-[-0.015em] text-white"
        >
          Built from what you shared
        </h2>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-[22px_1fr] gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 text-[#69baff]" aria-hidden="true" />
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#9fd5ff]">
              Goal
            </h3>
            <p className="mt-1 text-sm leading-5 text-[#e8f1f8]">{brief.recommendation}</p>
          </div>
        </div>

        <div className="grid grid-cols-[22px_1fr] gap-3">
          <ListChecks className="mt-0.5 h-5 w-5 text-[#69baff]" aria-hidden="true" />
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#9fd5ff]">
              Scope checklist
            </h3>
            <ul className="mt-1.5 space-y-1.5 text-sm leading-5 text-[#d9e6f0]">
              {scopeChecklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2e8fff]" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {keyQuestion ? (
          <div className="grid grid-cols-[22px_1fr] gap-3 rounded-[14px] border border-[#2b4965] bg-[#10243a] px-3 py-3">
            <MessageCircleQuestion className="mt-0.5 h-5 w-5 text-[#69baff]" aria-hidden="true" />
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#9fd5ff]">
                Key question
              </h3>
              <p className="mt-1 text-sm leading-5 text-white">{keyQuestion}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
