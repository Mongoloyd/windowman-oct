import { CheckCircle } from 'lucide-react';

const STEPS = [
  'Scan Complete',
  'Reveal',
  'Diagnosis',
  'Prescription',
  'Handoff',
] as const;

export type PostUploadRailStep = 1 | 2 | 3 | 4 | 5;

interface PostUploadProgressRailProps {
  activeStep: PostUploadRailStep;
  compact?: boolean;
}

export function PostUploadProgressRail({
  activeStep,
  compact = false,
}: PostUploadProgressRailProps) {
  const activeLabel = STEPS[activeStep - 1];

  return (
    <div className="border-b border-border/50 bg-white/55 backdrop-blur-md px-4 py-3 relative z-10 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {compact ? (
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700 truncate">
              {activeLabel}
            </p>
            <p className="shrink-0 text-xs font-bold text-slate-600">
              {activeStep}/{STEPS.length}
            </p>
          </div>
        ) : null}

        <div
          className={`flex items-center gap-1 sm:gap-2 ${compact ? 'mt-2' : ''} overflow-x-auto`}
          aria-label="Post-upload progress"
        >
          {STEPS.map((label, index) => {
            const stepNum = (index + 1) as PostUploadRailStep;
            const isComplete = stepNum < activeStep;
            const isActive = stepNum === activeStep;

            return (
              <div key={label} className="flex items-center gap-1 sm:gap-2 shrink-0">
                <div className="flex flex-col items-center gap-1 min-w-[2.75rem] sm:min-w-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isComplete || isActive
                        ? 'text-white'
                        : 'bg-muted text-muted-foreground'
                    } ${isActive ? 'ring-4 ring-cobalt/15' : ''}`}
                    style={
                      isComplete || isActive
                        ? {
                            background:
                              'linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)',
                            boxShadow:
                              'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(37,99,235,0.25)',
                          }
                        : undefined
                    }
                  >
                    {isComplete ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span
                    className={`hidden sm:block text-[10px] font-semibold leading-tight text-center max-w-[4.5rem] ${
                      isActive ? 'text-blue-700' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-4 sm:w-8 h-0.5 mb-4 sm:mb-5 ${
                      stepNum < activeStep ? 'bg-cobalt' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {compact ? (
          <p className="sm:hidden mt-1 text-[10px] font-semibold text-slate-600 truncate">
            Step {activeStep}: {activeLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
