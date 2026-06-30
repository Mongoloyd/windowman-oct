import { useState } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import type { DiagnosticConfig, DiagnosticContext } from '../types';
import { PropertyAndConsentStep } from '@/components/HomeownerHumanContext/PropertyAndConsentStep';

interface SuccessScreenProps {
  context: DiagnosticContext;
  activeConfig: DiagnosticConfig | null;
  onReturn: () => void;
}

export function SuccessScreen({ context, activeConfig, onReturn }: SuccessScreenProps) {
  // Phase 10 — Human Context capture is shown ONLY after the diagnosis was
  // successfully saved (which itself runs after report unlock + OTP). This
  // keeps Verify-to-Reveal intact: capture never gates report access.
  const [contextCaptured, setContextCaptured] = useState(false);
  const canCapture = !!context.lead_id && !!context.scan_session_id;
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"
      style={{ background: 'linear-gradient(170deg, #dce8f4 0%, #e4edf6 30%, #eaeff8 60%, #dde6f2 100%)' }}
    >
      {/* Soft cobalt ambient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(30,80,180,0.08) 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(6,182,212,0.06) 0%, transparent 55%)',
        }}
      />

      <div className="card-raised-hero p-10 rounded-2xl max-w-md w-full border-double border-4 border-cobalt/15 relative z-10">
        <div
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{
            background: 'linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 12px rgba(37,99,235,0.3)',
          }}
        >
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground mb-3">
          Diagnosis Saved
        </h2>
        <p className="text-foreground/75 mb-6">
          We now understand exactly what was off in your original estimate — and your replacement
          brief is sharper, more specific, and tied to the gaps your report flagged.
        </p>

        {activeConfig && (
          <div
            className={`${activeConfig.accentBg} ${activeConfig.accentBorder} border rounded-lg p-4 mb-6 text-left`}
          >
            <p className="wm-eyebrow uppercase text-muted-foreground mb-1">
              Your prescribed path
            </p>
            <p className="font-semibold text-foreground">{activeConfig.guaranteeTitle}</p>
          </div>
        )}

        <div
          className="rounded-xl p-5 mb-6 text-left"
          style={{
            background: 'linear-gradient(180deg, hsl(210 40% 98%) 0%, hsl(210 40% 94%) 100%)',
            border: '1px solid hsl(210 30% 80%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(37,99,235,0.3)',
              }}
            >
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="wm-eyebrow uppercase mb-1 text-muted-foreground">
                Next Step
              </p>
              <p className="text-base font-semibold text-foreground leading-snug">
                Return to your Truth Report
              </p>
              <p className="text-sm mt-1.5 text-muted-foreground">
                Your diagnosis is now attached to this report. You can revisit it any time.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onReturn}
          className="text-cobalt font-semibold hover:text-cobalt-dim transition-colors"
        >
          Use This Report Before I Sign →
        </button>
      </div>

      {/* Phase 10 — optional human-context capture, shown beneath the main card.
          Skippable, never blocking. */}
      {canCapture && !contextCaptured && (
        <div className="relative z-10 mt-6 max-w-md w-full">
          <PropertyAndConsentStep
            leadId={context.lead_id!}
            scanSessionId={context.scan_session_id!}
            onSubmitted={() => setContextCaptured(true)}
            onSkipped={() => setContextCaptured(true)}
          />
        </div>
      )}
    </div>
  );
}
