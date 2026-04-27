import { CheckCircle, Sparkles } from "lucide-react";

interface ProgressIndicatorProps {
  stepNumber: number;
}

export function ProgressIndicator({ stepNumber }: ProgressIndicatorProps) {
  return (
    <div className="border-b border-border/50 bg-white/55 backdrop-blur-md px-6 py-3 relative z-10">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="wm-eyebrow text-muted-foreground inline-flex items-center gap-2 uppercase">
          <Sparkles className="w-4 h-4 text-cobalt" />
          WindowMan To The Rescue
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  n < stepNumber
                    ? "text-white"
                    : n === stepNumber
                      ? "text-white ring-4 ring-cobalt/15"
                      : "bg-muted text-muted-foreground"
                }`}
                style={
                  n <= stepNumber
                    ? {
                        background: "linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(37,99,235,0.25)",
                      }
                    : undefined
                }
              >
                {n < stepNumber ? <CheckCircle className="w-3.5 h-3.5" /> : n}
              </div>
              {n < 3 && <div className={`w-8 h-0.5 ${n < stepNumber ? "bg-cobalt" : "bg-border"}`} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
