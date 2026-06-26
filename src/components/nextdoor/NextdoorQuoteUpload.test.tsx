import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextdoorQuoteUpload } from "./NextdoorQuoteUpload";

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

describe("NextdoorQuoteUpload trusted-pair gate", () => {
  it("mounts UploadZone with the matching pair when trusted and visible", () => {
    render(
      <NextdoorQuoteUpload
        sessionId={SESSION_ID}
        leadId={LEAD_ID}
        isVisible
        onScanStart={vi.fn()}
      />,
    );
    const zone = screen.getByTestId("upload-zone");
    expect(zone.getAttribute("data-session")).toBe(SESSION_ID);
    expect(zone.getAttribute("data-lead")).toBe(LEAD_ID);
  });

  it("does not mount UploadZone when leadId is missing", () => {
    render(
      <NextdoorQuoteUpload
        sessionId={SESSION_ID}
        leadId={null}
        isVisible
        onScanStart={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("upload-zone")).toBeNull();
  });

  it("does not mount UploadZone when sessionId is not a valid UUID", () => {
    render(
      <NextdoorQuoteUpload
        sessionId="not-a-uuid"
        leadId={LEAD_ID}
        isVisible
        onScanStart={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("upload-zone")).toBeNull();
  });

  it("does not mount UploadZone when not visible", () => {
    render(
      <NextdoorQuoteUpload
        sessionId={SESSION_ID}
        leadId={LEAD_ID}
        isVisible={false}
        onScanStart={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("upload-zone")).toBeNull();
  });
});
