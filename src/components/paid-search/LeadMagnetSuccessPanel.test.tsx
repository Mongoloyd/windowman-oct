import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const navigateMock = vi.fn();
const setLeadIdMock = vi.fn();
const setSessionIdMock = vi.fn();
const pushLeadMagnetUploadCtaClickedMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/state/scanFunnel", () => ({
  useScanFunnelSafe: () => ({
    setLeadId: setLeadIdMock,
    setSessionId: setSessionIdMock,
  }),
}));

vi.mock("@/lib/tracking/dataLayer", () => ({
  pushLeadMagnetUploadCtaClicked: (...args: unknown[]) =>
    pushLeadMagnetUploadCtaClickedMock(...args),
}));

import { LeadMagnetSuccessPanel } from "./LeadMagnetSuccessPanel";

const LEAD_ID = "lead-panel-1";
const SESSION_ID = "session-panel-1";

describe("LeadMagnetSuccessPanel", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setLeadIdMock.mockReset();
    setSessionIdMock.mockReset();
    pushLeadMagnetUploadCtaClickedMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fires lead_magnet_upload_cta_clicked with handoff_source matching the variant, then navigates with a single '?'", () => {
    render(
      <LeadMagnetSuccessPanel
        firstName="Jane"
        email="jane@example.com"
        leadId={LEAD_ID}
        sessionId={SESSION_ID}
        variant="window_price_audit"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Upload My Quote/i }));

    expect(setLeadIdMock).toHaveBeenCalledWith(LEAD_ID);
    expect(setSessionIdMock).toHaveBeenCalledWith(SESSION_ID);

    expect(pushLeadMagnetUploadCtaClickedMock).toHaveBeenCalledTimes(1);
    expect(pushLeadMagnetUploadCtaClickedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        handoffSource: "window_price_audit",
        destinationUrl: "/?post_capture=upload&source=window_price_audit",
      }),
    );

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const destination = navigateMock.mock.calls[0][0] as string;
    expect(destination).toBe("/?post_capture=upload&source=window_price_audit");
    expect(destination.match(/\?/g)).toHaveLength(1);
  });

  it.each([
    ["truth_report_demo"],
    ["ai_demo"],
    ["window_prices"],
  ] as const)("uses %s as the handoff_source and URL source param", (variant) => {
    render(
      <LeadMagnetSuccessPanel
        leadId={LEAD_ID}
        sessionId={SESSION_ID}
        variant={variant}
      />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(pushLeadMagnetUploadCtaClickedMock).toHaveBeenCalledWith(
      expect.objectContaining({ handoffSource: variant }),
    );
    expect(navigateMock).toHaveBeenCalledWith(
      `/?post_capture=upload&source=${variant}`,
    );
  });

  it("still navigates and skips the event when leadId/sessionId are missing", () => {
    render(<LeadMagnetSuccessPanel variant="window_price_audit" />);

    fireEvent.click(screen.getByRole("button", { name: /Upload My Quote/i }));

    expect(setLeadIdMock).not.toHaveBeenCalled();
    expect(pushLeadMagnetUploadCtaClickedMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith(
      "/?post_capture=upload&source=window_price_audit",
    );
  });
});
