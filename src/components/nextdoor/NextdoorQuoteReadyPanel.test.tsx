import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextdoorQuoteReadyPanel } from "./NextdoorPrepPanel";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

vi.mock("@/components/UploadZone", () => ({
  default: (props: Record<string, unknown>) => (
    <div
      data-testid="upload-zone"
      data-session={String(props.sessionId)}
      data-lead={String(props.leadId)}
    />
  ),
}));

vi.mock("@/components/TruthGateFlow", () => ({
  hasTrustedContactIdentity: (
    leadId: string | null | undefined,
    sessionId: string | null | undefined,
  ) =>
    typeof leadId === "string" &&
    UUID_RE.test(leadId) &&
    typeof sessionId === "string" &&
    UUID_RE.test(sessionId),
}));

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function renderPanel(props: Partial<Parameters<typeof NextdoorQuoteReadyPanel>[0]>) {
  return render(
    <NextdoorQuoteReadyPanel
      identitySubmitted={false}
      sessionId={SESSION_ID}
      leadId={null}
      onScrollToIdentity={vi.fn()}
      onScanStart={vi.fn()}
      {...props}
    />,
  );
}

describe("NextdoorQuoteReadyPanel upload gate", () => {
  it("shows the locked upload state when no trusted identity exists", () => {
    renderPanel({ identitySubmitted: false, leadId: null });
    expect(screen.queryByTestId("upload-zone")).toBeNull();
    expect(screen.getByText(/unlocks after you save your details/i)).toBeInTheDocument();
  });

  it("does not mount usable upload with identitySubmitted alone (no leadId)", () => {
    renderPanel({ identitySubmitted: true, leadId: null });
    expect(screen.queryByTestId("upload-zone")).toBeNull();
  });

  it("mounts usable upload only with a trusted leadId + sessionId pair", () => {
    renderPanel({ identitySubmitted: true, leadId: LEAD_ID });
    const zone = screen.getByTestId("upload-zone");
    expect(zone.getAttribute("data-session")).toBe(SESSION_ID);
    expect(zone.getAttribute("data-lead")).toBe(LEAD_ID);
  });
});
