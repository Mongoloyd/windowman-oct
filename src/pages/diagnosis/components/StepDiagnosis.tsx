import { ArrowLeft, ArrowRight } from 'lucide-react';
import { WINDOW_STYLES, WINDOW_CONCERNS, FRAME_MATERIALS } from '../constants/windowOptions';
import type { DiagnosisCode, DiagnosticConfig } from '../types';

interface StepDiagnosisProps {
  activeConfig: DiagnosticConfig;
  primaryDiagnosis: DiagnosisCode;
  secondaryClarifiers: string[];
  otherFreeText: string;
  windowStyles: string[];
  windowConcerns: string[];
  frameMaterial: string;
  canAdvanceFromDiagnosis: boolean;
  onBack: () => void;
  onAdvance: () => void;
  setOtherFreeText: (v: string) => void;
  setFrameMaterial: (v: string) => void;
  toggleInArray: (
    arr: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => void;
  setSecondaryClarifiers: React.Dispatch<React.SetStateAction<string[]>>;
  setWindowStyles: React.Dispatch<React.SetStateAction<string[]>>;
  setWindowConcerns: React.Dispatch<React.SetStateAction<string[]>>;
}

const chipBase =
  'px-4 py-2 rounded-full text-sm font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-cobalt/40';

const chipUnselected =
  'bg-white/80 border-border text-foreground/80 hover:border-cobalt/40 hover:bg-white';

const chipSelectedCobalt =
  'border-cobalt text-white shadow-sm';

const cobaltSelectedStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(37,99,235,0.22)',
};

const numberBadgeStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #6bb8ff 0%, #3b82f6 40%, #1d4ed8 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(37,99,235,0.25)',
};

export function StepDiagnosis({
  activeConfig,
  primaryDiagnosis,
  secondaryClarifiers,
  otherFreeText,
  windowStyles,
  windowConcerns,
  frameMaterial,
  canAdvanceFromDiagnosis,
  onBack,
  onAdvance,
  setOtherFreeText,
  setFrameMaterial,
  toggleInArray,
  setSecondaryClarifiers,
  setWindowStyles,
  setWindowConcerns,
}: StepDiagnosisProps) {
  return (
    <section className="relative py-12 px-6 min-h-[calc(100vh-160px)]" style={{ background: 'transparent' }}>
      {/* Soft cobalt ambient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(30,80,180,0.07) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(6,182,212,0.06) 0%, transparent 55%)',
        }}
      />
      <div className="max-w-3xl mx-auto relative z-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Change My Answer
        </button>

        {/* Therapeutic Reflection Panel */}
        <div className="card-raised-hero rounded-2xl p-6 md:p-8 mb-8">
          <div className="flex items-start gap-4">
            <div
              className={`shrink-0 w-12 h-12 rounded-xl bg-white ${activeConfig.accentBorder} border-2 flex items-center justify-center`}
            >
              <activeConfig.Icon className={`w-6 h-6 ${activeConfig.accent}`} />
            </div>
            <div className="flex-1">
              <h2 className={`font-display text-2xl font-extrabold tracking-tight ${activeConfig.accent} mb-3`}>
                {activeConfig.reflectionTitle}
              </h2>
              <p className="text-foreground/85 text-base leading-relaxed">
                {activeConfig.reflectionBody}
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-muted-foreground text-sm mb-6 italic">
          A Few Quick Questions So We Can Shape Your Prescription. All Taps, No Typing.
        </p>

        {/* Question 1: Secondary Clarifier */}
        <div className="card-raised rounded-2xl p-6 md:p-8 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold"
              style={numberBadgeStyle}
            >
              1
            </div>
            <p className="wm-eyebrow uppercase text-muted-foreground">
              Diagnostic
            </p>
          </div>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mb-4">
            {activeConfig.secondaryQuestion}
          </h3>

          {primaryDiagnosis === 'other' ? (
            <textarea
              value={otherFreeText}
              onChange={(e) => setOtherFreeText(e.target.value)}
              rows={4}
              placeholder="Tell us what felt off. There's no wrong answer."
              className="wm-input-well w-full px-4 py-3 outline-none transition-all resize-none text-foreground placeholder:text-muted-foreground"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeConfig.secondaryOptions.map((option) => {
                const isSelected = secondaryClarifiers.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      toggleInArray(secondaryClarifiers, setSecondaryClarifiers, option)
                    }
                    className={`${chipBase} ${isSelected ? chipSelectedCobalt : chipUnselected}`}
                    style={isSelected ? cobaltSelectedStyle : undefined}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Question 2: Window Styles */}
        <div className="card-raised rounded-2xl p-6 md:p-8 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold"
              style={numberBadgeStyle}
            >
              2
            </div>
            <p className="wm-eyebrow uppercase text-muted-foreground">
              Window Types
            </p>
          </div>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mb-1">
            Which Window Styles Are Part of this Project?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Tap Any That Apply.</p>
          <div className="flex flex-wrap gap-2">
            {WINDOW_STYLES.map((style) => {
              const isSelected = windowStyles.includes(style);
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => toggleInArray(windowStyles, setWindowStyles, style)}
                  className={`${chipBase} ${isSelected ? chipSelectedCobalt : chipUnselected}`}
                  style={isSelected ? cobaltSelectedStyle : undefined}
                >
                  {style}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question 3: Concerns */}
        <div className="card-raised rounded-2xl p-6 md:p-8 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold"
              style={numberBadgeStyle}
            >
              3
            </div>
            <p className="wm-eyebrow uppercase text-muted-foreground">
              Priorities
            </p>
          </div>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mb-1">
            What Matters Most To You?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Tap Everything That's Important.</p>
          <div className="flex flex-wrap gap-2">
            {WINDOW_CONCERNS.map((concern) => {
              const isSelected = windowConcerns.includes(concern);
              return (
                <button
                  key={concern}
                  type="button"
                  onClick={() => toggleInArray(windowConcerns, setWindowConcerns, concern)}
                  className={`${chipBase} ${
                    isSelected
                      ? 'border-emerald text-white shadow-sm'
                      : chipUnselected
                  }`}
                  style={
                    isSelected
                      ? {
                          background:
                            'linear-gradient(180deg, hsl(160 75% 48%) 0%, hsl(160 84% 39%) 50%, hsl(160 84% 32%) 100%)',
                          boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px hsla(160 84% 39% / 0.22)',
                        }
                      : undefined
                  }
                >
                  {concern}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question 4: Frame Material (single-select chips) */}
        <div className="card-raised rounded-2xl p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold"
              style={numberBadgeStyle}
            >
              4
            </div>
            <p className="wm-eyebrow uppercase text-muted-foreground">
              Frame Material
            </p>
          </div>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mb-1">
            Frame Material Preference?
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Pick One. "Not Sure" is Fine.</p>
          <div className="flex flex-wrap gap-2">
            {FRAME_MATERIALS.map(({ value, label }) => {
              const isSelected = frameMaterial === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFrameMaterial(isSelected ? '' : value)}
                  className={`${chipBase} ${isSelected ? chipSelectedCobalt : chipUnselected}`}
                  style={isSelected ? cobaltSelectedStyle : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Advance */}
        <div className="card-raised-hero rounded-2xl p-6 md:p-8 border-double border-4 border-cobalt/15">
          <p className="text-sm text-foreground/80 leading-relaxed mb-6">
            {activeConfig.prescriptionSetup}
          </p>
          <button
            onClick={onAdvance}
            disabled={!canAdvanceFromDiagnosis}
            className={`btn-depth-primary w-full inline-flex items-center justify-center gap-2 py-4 px-6 text-base ${
              !canAdvanceFromDiagnosis ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            See How We'll Fix This <ArrowRight className="w-5 h-5" />
          </button>
          {!canAdvanceFromDiagnosis && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              {primaryDiagnosis === 'other'
                ? 'Tell us a little more so we can tailor the prescription.'
                : 'Pick at least one option from question 1 to continue.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
