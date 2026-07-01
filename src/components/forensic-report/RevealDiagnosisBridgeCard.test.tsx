import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RevealDiagnosisBridgeCard from './RevealDiagnosisBridgeCard';

describe('RevealDiagnosisBridgeCard', () => {
  it('renders split headlines as separate elements', () => {
    render(<RevealDiagnosisBridgeCard />);

    expect(screen.getByRole('heading', { level: 2, name: 'Your quote has problems.' })).toBeInTheDocument();
    expect(screen.getByText("Now let's help you get a better one.")).toBeInTheDocument();
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
