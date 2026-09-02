import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RevealDiagnosisBridgeCard, {
  FALLBACK_BRIDGE_EXPLANATION,
  WINDOWMAN_BRIDGE_TRANSITION,
} from './RevealDiagnosisBridgeCard';

const READY_SUMMARY =
  'This estimate leaves permit responsibility unclear and prices rot repairs as extras. Deposit terms also lock you in before the scope is verified. Those gaps are the ones that usually become change orders.';

describe('RevealDiagnosisBridgeCard', () => {
  it('renders split headlines as separate elements', () => {
    render(<RevealDiagnosisBridgeCard />);

    expect(screen.getByRole('heading', { level: 2, name: 'Your quote has problems.' })).toBeInTheDocument();
    expect(screen.getByText("Now let's help you get a better one.")).toBeInTheDocument();
  });

  it('renders an authorized summaryBody in place of the generic paragraph', () => {
    render(<RevealDiagnosisBridgeCard summaryBody={READY_SUMMARY} />);

    expect(screen.getByText(READY_SUMMARY)).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK_BRIDGE_EXPLANATION)).not.toBeInTheDocument();
  });

  it('renders the exact generic paragraph when summaryBody is null', () => {
    render(<RevealDiagnosisBridgeCard summaryBody={null} />);

    expect(screen.getByText(FALLBACK_BRIDGE_EXPLANATION)).toBeInTheDocument();
  });

  it('renders the exact generic paragraph when summaryBody is whitespace', () => {
    render(<RevealDiagnosisBridgeCard summaryBody="   " />);

    expect(screen.getByText(FALLBACK_BRIDGE_EXPLANATION)).toBeInTheDocument();
  });

  it('renders the static WindowMan transition before the CTA', () => {
    render(<RevealDiagnosisBridgeCard ctaEnabled onPrimaryClick={vi.fn()} summaryBody={READY_SUMMARY} />);

    expect(screen.getByText(WINDOWMAN_BRIDGE_TRANSITION)).toBeInTheDocument();
    const transition = screen.getByText(WINDOWMAN_BRIDGE_TRANSITION);
    const cta = screen.getByRole('button', { name: /A Better Quote is Moments Away/i });
    expect(transition.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the prescribed hero image', () => {
    render(<RevealDiagnosisBridgeCard />);

    const image = screen.getByRole('img', {
      name: /WindowMan prescription/i,
    });
    expect(image).toHaveAttribute('src', '/images/wm-prescribed-for-you.avif');
  });

  it('renders the updated primary CTA label when enabled', () => {
    render(<RevealDiagnosisBridgeCard ctaEnabled onPrimaryClick={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: /A Better Quote is Moments Away/i }),
    ).toBeInTheDocument();
  });

  it('fires onPrimaryClick when the CTA is clicked', () => {
    const onPrimaryClick = vi.fn();

    render(<RevealDiagnosisBridgeCard ctaEnabled onPrimaryClick={onPrimaryClick} />);

    fireEvent.click(screen.getByRole('button', { name: /A Better Quote is Moments Away/i }));

    expect(onPrimaryClick).toHaveBeenCalledTimes(1);
  });

  it('shows fallback copy when CTA is disabled', () => {
    render(<RevealDiagnosisBridgeCard ctaEnabled={false} />);

    expect(
      screen.getByText(/Return to your homepage report flow to continue/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /A Better Quote is Moments Away/i })).not.toBeInTheDocument();
  });
});
