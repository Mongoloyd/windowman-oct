import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StepDiagnosis, FINAL_CTA_DELAY_MS } from './StepDiagnosis';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

const mockOnAdvance = vi.fn();
const mockOnBack = vi.fn();

const activeConfig = {
  reflectionTitle: 'We hear the hesitation.',
  reflectionBody:
    'A few quick answers will help us shape the right next step for your situation.',
  accent: 'text-cobalt',
  accentBorder: 'border-cobalt/30',
  Icon: () => <span data-testid="mock-icon" />,
  secondaryQuestion: 'What made you uncomfortable?',
  secondaryOptions: ['They were pushy', 'Price felt off', 'Scope unclear'],
  prescriptionSetup:
    "We have got enough to shape your next step and open your recommendation view.",
} as any;

function TestHarness({
  primaryDiagnosis = 'trust_breakdown' as any,
  onAdvance = mockOnAdvance,
  onBack = mockOnBack,
}: {
  primaryDiagnosis?: any;
  onAdvance?: () => void;
  onBack?: () => void;
}) {
  const [secondaryClarifiers, setSecondaryClarifiers] = useState<string[]>([]);
  const [otherFreeText, setOtherFreeText] = useState('');
  const [windowStyles, setWindowStyles] = useState<string[]>([]);
  const [windowConcerns, setWindowConcerns] = useState<string[]>([]);
  const [frameMaterial, setFrameMaterial] = useState('');
  const [contractorContext, setContractorContext] = useState<string[]>([]);
  const [desiredNextMove, setDesiredNextMove] = useState<string[]>([]);

  const canAdvanceFromDiagnosis =
    primaryDiagnosis === 'other'
      ? otherFreeText.trim().length >= 10
      : secondaryClarifiers.length > 0;

  return (
    <StepDiagnosis
      activeConfig={activeConfig}
      primaryDiagnosis={primaryDiagnosis}
      secondaryClarifiers={secondaryClarifiers}
      otherFreeText={otherFreeText}
      windowStyles={windowStyles}
      windowConcerns={windowConcerns}
      frameMaterial={frameMaterial}
      contractorContext={contractorContext}
      desiredNextMove={desiredNextMove}
      canAdvanceFromDiagnosis={canAdvanceFromDiagnosis}
      onBack={onBack}
      onAdvance={onAdvance}
      setOtherFreeText={setOtherFreeText}
      setFrameMaterial={setFrameMaterial}
      toggleInArray={(arr, setter, value) =>
        setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value])
      }
      setSecondaryClarifiers={setSecondaryClarifiers}
      setWindowStyles={setWindowStyles}
      setWindowConcerns={setWindowConcerns}
      setContractorContext={setContractorContext}
      setDesiredNextMove={setDesiredNextMove}
    />
  );
}

async function advanceThroughPreSalesSteps() {
  fireEvent.click(screen.getByRole('button', { name: /hurricane season/i }));
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: /when are you hoping to make a decision/i })
    ).toBeInTheDocument()
  );

  fireEvent.click(screen.getByRole('button', { name: /within 2 weeks/i }));
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: /who else needs to weigh in/i })
    ).toBeInTheDocument()
  );

  fireEvent.click(screen.getByRole('button', { name: /just me/i }));
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  await waitFor(() =>
    expect(
      screen.getByRole('heading', {
        name: /what happened with the contractor who gave you this quote/i,
      })
    ).toBeInTheDocument()
  );

  fireEvent.click(screen.getByRole('button', { name: /price felt high/i }));
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  await waitFor(() =>
    expect(
      screen.getByRole('heading', {
        name: /what do you want windowman to help you do next/i,
      })
    ).toBeInTheDocument()
  );

  fireEvent.click(screen.getByRole('button', { name: /understand this quote/i }));
}

describe('StepDiagnosis — 6-step pre-sales flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts on branch secondary question only', () => {
    render(<TestHarness />);

    expect(
      screen.getByRole('heading', { name: /what made you uncomfortable/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: /what made you start looking at impact windows now/i,
      })
    ).not.toBeInTheDocument();
  });

  it('advances from step 1 to urgency after branch selection', async () => {
    render(<TestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /they were pushy/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: /what made you start looking at impact windows now/i,
        })
      ).toBeInTheDocument()
    );
  });

  it('does not show window style or frame material questions', () => {
    render(<TestHarness />);

    expect(
      screen.queryByRole('heading', {
        name: /which window styles are part of this project/i,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /frame material preference/i })
    ).not.toBeInTheDocument();
  });

  it(
    'reveals final CTA after step 6 selection',
    async () => {
      render(<TestHarness />);

      fireEvent.click(screen.getByRole('button', { name: /they were pushy/i }));
      fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

      await advanceThroughPreSalesSteps();

      await waitFor(
        () =>
          expect(
            screen.getByRole('button', { name: /continue to my prescription/i })
          ).toBeInTheDocument(),
        { timeout: FINAL_CTA_DELAY_MS + 500 }
      );
    },
    FINAL_CTA_DELAY_MS + 2000
  );

  it('uses free text for other branch on step 1', async () => {
    render(<TestHarness primaryDiagnosis="other" />);

    expect(screen.getByPlaceholderText(/tell us what felt off/i)).toBeInTheDocument();
  });
});
