import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StepDiagnosis } from './StepDiagnosis';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
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
  secondaryOptions: ['Too pushy', 'Price felt off', 'Scope unclear'],
  prescriptionSetup:
    'We’ve got enough to shape your next step and open your recommendation view.',
} as any;

function TestHarness({
  primaryDiagnosis = 'price' as any,
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
      canAdvanceFromDiagnosis={canAdvanceFromDiagnosis}
      onBack={onBack}
      onAdvance={onAdvance}
      setOtherFreeText={setOtherFreeText}
      setFrameMaterial={setFrameMaterial}
      toggleInArray={(arr, setter, value) => {
        setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
      }}
      setSecondaryClarifiers={setSecondaryClarifiers}
      setWindowStyles={setWindowStyles}
      setWindowConcerns={setWindowConcerns}
    />
  );
}

async function moveToStep4() {
  fireEvent.click(screen.getByRole('button', { name: /too pushy/i }));
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: /which window styles are part of this project/i })
    ).toBeInTheDocument()
  );

  fireEvent.click(screen.getByRole('button', { name: /single hung/i }));
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: /what matters most to you/i })
    ).toBeInTheDocument()
  );

  fireEvent.click(screen.getByRole('button', { name: /energy efficiency/i }));
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: /frame material preference/i })
    ).toBeInTheDocument()
  );
}

describe('StepDiagnosis — one-question consultation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts on Question 1 only and does not show Question 2 yet', () => {
    render(<TestHarness />);

    expect(
      screen.getByRole('heading', { name: /what made you uncomfortable/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('heading', {
        name: /which window styles are part of this project/i,
      })
    ).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /^continue$/i })).not.toBeInTheDocument();
  });

  it('reveals Continue on Step 1 after a valid selection and advances to Step 2', async () => {
    render(<TestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /too pushy/i }));

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: /which window styles are part of this project/i,
        })
      ).toBeInTheDocument()
    );
  });

  it('keeps Continue hidden on Step 2 until a window style is selected', async () => {
    render(<TestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /too pushy/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          name: /which window styles are part of this project/i,
        })
      ).toBeInTheDocument()
    );

    expect(screen.queryByRole('button', { name: /^continue$/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /single hung/i }));

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();
  });

  it('reveals the final CTA on Step 4 only after a short delay', async () => {
    vi.useFakeTimers();
    render(<TestHarness />);

    await moveToStep4();

    expect(
      screen.queryByRole('button', { name: /show me what's next/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^vinyl$/i }));

    expect(
      screen.queryByRole('button', { name: /show me what's next/i })
    ).not.toBeInTheDocument();

    vi.advanceTimersByTime(360);

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /show me what's next/i })
      ).toBeInTheDocument()
    );
  });

  it('calls onAdvance only after the final CTA is clicked on Step 4', async () => {
    vi.useFakeTimers();
    render(<TestHarness onAdvance={mockOnAdvance} />);

    await moveToStep4();

    fireEvent.click(screen.getByRole('button', { name: /^vinyl$/i }));
    vi.advanceTimersByTime(360);

    const finalButton = await screen.findByRole('button', {
      name: /show me what's next/i,
    });

    fireEvent.click(finalButton);

    expect(mockOnAdvance).toHaveBeenCalledTimes(1);
  });

  it('uses textarea validation for the "other" diagnosis path', () => {
    render(<TestHarness primaryDiagnosis="other" />);

    expect(screen.queryByRole('button', { name: /^continue$/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/tell us what felt off/i), {
      target: { value: 'The quote felt vague and too rushed.' },
    });

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();
  });
});
