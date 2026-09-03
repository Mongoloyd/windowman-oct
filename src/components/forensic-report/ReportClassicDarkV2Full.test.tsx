import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AnalysisData } from '@/hooks/useAnalysisData';
import ReportClassicDarkV2Full from './ReportClassicDarkV2Full';
import { FALLBACK_BRIDGE_EXPLANATION } from './RevealDiagnosisBridgeCard';

const READY_SUMMARY =
  'This estimate leaves permit responsibility unclear and prices rot repairs as extras. Deposit terms also lock you in before the scope is verified. Those gaps are the ones that usually become change orders.';

function baseAnalysisData(overrides: Partial<AnalysisData> = {}): AnalysisData {
  return {
    analysisId: 'test-analysis',
    grade: 'C',
    flags: [],
    flagCount: 3,
    flagRedCount: 2,
    flagAmberCount: 1,
    contractorName: null,
    confidenceScore: 0.9,
    pillarScores: [],
    documentType: 'estimate',
    pageCount: 4,
    openingCount: 14,
    lineItemCount: 3,
    qualityBand: null,
    hasWarranty: null,
    hasPermits: null,
    analysisStatus: 'complete',
    warnings: [],
    missingItems: [],
    summary: null,
    topWarning: null,
    topMissingItem: null,
    pricePerOpening: null,
    pricePerOpeningBand: null,
    paymentRiskDetected: false,
    scopeGapDetected: false,
    summaryTeaser: 'Existing teaser copy for the executive band only.',
    missingItemsCount: 0,
    reportSummaryBody: null,
    ...overrides,
  };
}

function renderFull(analysisData: AnalysisData, onDiagnosisCta = vi.fn()) {
  return render(
    <MemoryRouter>
      <ReportClassicDarkV2Full
        analysisData={analysisData}
        v2ReportSource={{}}
        county="Broward"
        scanSessionId="11111111-1111-4111-8111-111111111111"
        onDiagnosisCta={onDiagnosisCta}
      />
    </MemoryRouter>,
  );
}

describe('ReportClassicDarkV2Full Summary V1 bridge wiring', () => {
  it('passes authorized reportSummaryBody into the bridge card', () => {
    renderFull(baseAnalysisData({ reportSummaryBody: READY_SUMMARY }));

    expect(screen.getByText(READY_SUMMARY)).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK_BRIDGE_EXPLANATION)).not.toBeInTheDocument();
  });

  it('does not route reportSummaryBody into ExecutiveSummaryBand', () => {
    renderFull(baseAnalysisData({ reportSummaryBody: READY_SUMMARY }));

    const bandHeading = screen.getByRole('heading', { name: /PLAIN-ENGLISH SUMMARY/i });
    const band = bandHeading.closest('section');
    expect(band).not.toBeNull();
    expect(within(band as HTMLElement).queryByText(READY_SUMMARY)).not.toBeInTheDocument();
    expect(
      within(band as HTMLElement).getByText('Existing teaser copy for the executive band only.'),
    ).toBeInTheDocument();
  });

  it('keeps the existing Better Quote CTA wired to the diagnosis handoff', () => {
    const onDiagnosisCta = vi.fn();
    renderFull(baseAnalysisData({ reportSummaryBody: READY_SUMMARY }), onDiagnosisCta);

    const button = screen.getByRole('button', { name: /A Better Quote is Moments Away/i });
    fireEvent.click(button);

    expect(onDiagnosisCta).toHaveBeenCalledTimes(1);
  });
});
