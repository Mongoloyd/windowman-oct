import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  WINDOW_STYLES,
  WINDOW_CONCERNS,
  FRAME_MATERIALS,
} from '../constants/windowOptions';
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
    setter: Dispatch<SetStateAction<string[]>>,
    value: string
  ) => void;
  setSecondaryClarifiers: Dispatch<SetStateAction<string[]>>;
  setWindowStyles: Dispatch<SetStateAction<string[]>>;
  setWindowConcerns: Dispatch<SetStateAction<string[]>>;
}

type ConsultationStep = 1 | 2 | 3 | 4;

export const FINAL_CTA_DELAY_MS = 360;

const shellStyle: CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.78) 100%)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(148,163,184,0.14), 0 18px 48px rgba(15,23,42,0.08), 0 2px 10px rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,255,255,0.85)',
};

const notePanelStyle: CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.64) 100%)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(148,163,184,0.12), 0 14px 34px rgba(15,23,42,0.06)',
  border: '1px solid rgba(255,255,255,0.78)',
};

const footerDividerStyle: CSSProperties = {
  borderTop: '1px solid rgba(148,163,184,0.20)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
};

const silhouetteStyle: CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.34) 100%)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.85), 0 18px 36px rgba(15,23,42,0.04)',
  border: '1px solid rgba(255,255,255,0.7)',
};

const chipBase =
  'relative rounded-2xl px-4 py-3 text-sm font-medium text-left transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-cobalt/30 border text-slate-700 hover:bg-white/70 border-surface-border';

const chipUnselected = '';

const chipSelectedText = 'text-white';

const blueSelectedStyle: CSSProperties = {
  background:
    'linear-gradient(180deg, #7dc4ff 0%, #4b93ff 38%, #2563eb 100%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.34), inset 0 2px 10px rgba(12,74,190,0.28), 0 10px 24px rgba(37,99,235,0.20)',
  transform: 'translateY(1px)',
};

const greenSelectedStyle: CSSProperties = {
  background:
    'linear-gradient(180deg, #7be0c4 0%, #34d399 42%, #059669 100%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.34), inset 0 2px 10px rgba(5,150,105,0.26), 0 10px 24px rgba(5,150,105,0.18)',
  transform: 'translateY(1px)',
};

const frameSelectedStyle: CSSProperties = {
  background:
    'linear-gradient(180deg, #9cc9ff 0%, #60a5fa 40%, #2563eb 100%)',
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.34), inset 0 2px 10px rgba(29,78,216,0.24), 0 10px 24px rgba(37,99,235,0.18)',
  transform: 'translateY(1px)',
};

const stageVariants = {
  initial: { opacity: 0, y: 14, filter: 'blur(3px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -12,
    filter: 'blur(2px)',
    transition: { duration: 0.28, ease: [0.4, 0, 1, 1] as const },
  },
};

function OptionGrid({
  options,
  selectedValues,
  onToggle,
  selectedStyle,
}: {
  options: { value: string; label: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  selectedStyle: CSSProperties;
}) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(option.value)}
            className={`${chipBase} ${isSelected ? chipSelectedText : chipUnselected}`}
            style={isSelected ? selectedStyle : undefined}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ReservedFooter({
  visible,
  label,
  onClick,
  helperText,
}: {
  visible: boolean;
  label: string;
  onClick: () => void;
  helperText?: string;
}) {
  return (
    <div className="mt-8 min-h-[96px] pt-5" style={footerDividerStyle}>
      <AnimatePresence mode="wait" initial={false}>
        {visible ? (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.18 } }}
            className="flex flex-col items-stretch gap-3"
          >
            <button
              type="button"
              onClick={onClick}
              className="btn-depth-primary inline-flex w-full items-center justify-center gap-2 px-6 py-4 text-base"
            >
              {label}
              <ArrowRight className="h-5 w-5" />
            </button>
            {helperText ? (
              <p className="text-center text-xs text-slate-500">{helperText}</p>
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="footer-placeholder"
            initial={{ opacity: 0.45 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            className="h-full"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

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
  const [activeStep, setActiveStep] = useState<ConsultationStep>(1);
  const [finalActionVisible, setFinalActionVisible] = useState(false);

  useEffect(() => {
    if (activeStep !== 4) {
      setFinalActionVisible(false);
      return;
    }
    if (!frameMaterial) {
      setFinalActionVisible(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setFinalActionVisible(true);
    }, FINAL_CTA_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeStep, frameMaterial]);

  const canContinueCurrentStep = useMemo(() => {
    switch (activeStep) {
      case 1:
        return canAdvanceFromDiagnosis;
      case 2:
        return windowStyles.length > 0;
      case 3:
        return windowConcerns.length > 0;
      case 4:
        return Boolean(frameMaterial);
      default:
        return false;
    }
  }, [
    activeStep,
    canAdvanceFromDiagnosis,
    windowStyles.length,
    windowConcerns.length,
    frameMaterial,
  ]);

  const currentLabel = activeStep === 4 ? "Show Me What's Next" : "Continue";
  const showCurrentAction =
    activeStep === 4 ? finalActionVisible : canContinueCurrentStep;

  const handleBack = () => {
    if (activeStep === 1) {
      onBack();
      return;
    }
    setActiveStep((prev) => (prev > 1 ? ((prev - 1) as ConsultationStep) : prev));
  };

  const handleAdvance = () => {
    if (!canContinueCurrentStep) return;
    if (activeStep === 4) {
      onAdvance();
      return;
    }
    setActiveStep((prev) => ((prev + 1) as ConsultationStep));
  };

  const activeStepMeta = useMemo(() => {
    switch (activeStep) {
      case 1:
        return {
          eyebrow: 'Diagnostic',
          title: activeConfig.secondaryQuestion,
          subtitle:
            primaryDiagnosis === 'other'
              ? "Tell us what felt off in your own words."
              : "Tap everything that applies.",
        };
      case 2:
        return {
          eyebrow: 'Window Types',
          title: 'Which Window Styles Are Part of This Project?',
          subtitle: 'Tap any that apply.',
        };
      case 3:
        return {
          eyebrow: 'Priorities',
          title: 'What Matters Most To You?',
          subtitle: "Choose everything that's important.",
        };
      case 4:
      default:
        return {
          eyebrow: 'Frame Material',
          title: 'Frame Material Preference?',
          subtitle: 'Pick one. “Not Sure” is fine.',
        };
    }
  }, [activeStep, activeConfig.secondaryQuestion, primaryDiagnosis]);

  return (
    <section className="relative px-5 py-10 md:px-6 md:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(59,130,246,0.08) 0%, transparent 52%), radial-gradient(ellipse at 80% 100%, rgba(14,165,233,0.08) 0%, transparent 56%), linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(248,250,252,0.78) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        <button
          type="button"
          onClick={handleBack}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div
          className="mb-8 rounded-[28px] px-6 py-5 md:px-7"
          style={notePanelStyle}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 bg-white/80 ${activeConfig.accentBorder}`}
              style={{
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 18px rgba(15,23,42,0.05)',
              }}
            >
              <activeConfig.Icon className={`h-6 w-6 ${activeConfig.accent}`} />
            </div>

            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Consultation Notes
              </p>
              <h2 className={`mb-2 font-display text-2xl font-extrabold tracking-tight ${activeConfig.accent}`}>
                {activeConfig.reflectionTitle}
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">
                {activeConfig.reflectionBody}
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto min-h-[580px] max-w-4xl md:min-h-[620px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              variants={stageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="rounded-[32px] px-6 py-7 md:px-8 md:py-8"
              style={shellStyle}
            >
              <div className="mb-6">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {activeStepMeta.eyebrow}
                </p>
                <h3 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 md:text-[2rem]">
                  {activeStepMeta.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-500 md:text-[15px]">
                  {activeStepMeta.subtitle}
                </p>
              </div>

              {activeStep === 1 && (
                <div className="space-y-4">
                  {primaryDiagnosis === 'other' ? (
                    <textarea
                      value={otherFreeText}
                      onChange={(e) => setOtherFreeText(e.target.value)}
                      rows={5}
                      placeholder="Tell us what felt off. There's no wrong answer."
                      className="w-full rounded-[24px] border border-slate-200/80 bg-white/70 px-5 py-4 text-foreground outline-none transition-all placeholder:text-slate-400 focus:border-cobalt/40 focus:bg-white/80 focus:ring-2 focus:ring-cobalt/15"
                      style={{
                        boxShadow:
                          'inset 0 1px 2px rgba(15,23,42,0.05), inset 0 -1px 0 rgba(255,255,255,0.7)',
                      }}
                    />
                  ) : (
                    <OptionGrid
                      options={activeConfig.secondaryOptions.map((option) => ({
                        value: option,
                        label: option,
                      }))}
                      selectedValues={secondaryClarifiers}
                      onToggle={(value) =>
                        toggleInArray(
                          secondaryClarifiers,
                          setSecondaryClarifiers,
                          value
                        )
                      }
                      selectedStyle={blueSelectedStyle}
                    />
                  )}
                </div>
              )}

              {activeStep === 2 && (
                <OptionGrid
                  options={WINDOW_STYLES.map((style) => ({
                    value: style,
                    label: style,
                  }))}
                  selectedValues={windowStyles}
                  onToggle={(value) =>
                    toggleInArray(windowStyles, setWindowStyles, value)
                  }
                  selectedStyle={blueSelectedStyle}
                />
              )}

              {activeStep === 3 && (
                <OptionGrid
                  options={WINDOW_CONCERNS.map((concern) => ({
                    value: concern,
                    label: concern,
                  }))}
                  selectedValues={windowConcerns}
                  onToggle={(value) =>
                    toggleInArray(windowConcerns, setWindowConcerns, value)
                  }
                  selectedStyle={greenSelectedStyle}
                />
              )}

              {activeStep === 4 && (
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
                  {FRAME_MATERIALS.map(({ value, label }) => {
                    const isSelected = frameMaterial === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setFrameMaterial(isSelected ? '' : value)}
                        className={`${chipBase} ${isSelected ? chipSelectedText : chipUnselected}`}
                        style={isSelected ? frameSelectedStyle : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              <ReservedFooter
                visible={showCurrentAction}
                label={currentLabel}
                onClick={handleAdvance}
                helperText={
                  activeStep === 4 && showCurrentAction
                    ? activeConfig.prescriptionSetup
                    : undefined
                }
              />
            </motion.div>
          </AnimatePresence>

          {activeStep < 4 && (
            <div
              aria-hidden="true"
              className="mx-auto mt-4 h-14 w-[92%] rounded-[28px] opacity-60 blur-[1px]"
              style={silhouetteStyle}
            />
          )}
        </div>
      </div>
    </section>
  );
}
