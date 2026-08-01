import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PropertyAndConsentStep } from "@/components/HomeownerHumanContext/PropertyAndConsentStep";
import { CONTRACTOR_SHARING_AUTHORIZATION_COPY } from "@/components/consent/ContractorSharingConsentCheckbox";

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

function fillBasics() {
  fireEvent.click(screen.getByRole("radio", { name: /Single-family home/i }));
  fireEvent.click(screen.getByRole("radio", { name: /No HOA/i }));
}

function contractorCheckbox() {
  return screen.getByRole("checkbox", {
    name: new RegExp(CONTRACTOR_SHARING_AUTHORIZATION_COPY.slice(0, 40)),
  });
}

describe("PropertyAndConsentStep contractor consent", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it("shows contractor checkbox only when a contractor handoff is selected", () => {
    render(<PropertyAndConsentStep leadId={LEAD_ID} scanSessionId={SESSION_ID} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("radio", { name: /Yes — have someone call me today/i }),
    );
    expect(contractorCheckbox()).not.toBeChecked();
  });

  it.each([
    "Yes — have someone call me today",
    "Yes — tomorrow is better",
    "Text or email me first",
  ])("blocks submit when %s is selected without contractor authorization", (label) => {
    render(<PropertyAndConsentStep leadId={LEAD_ID} scanSessionId={SESSION_ID} />);
    fillBasics();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(label) }));

    const save = screen.getByRole("button", { name: /Save and continue/i });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("sends contractor_sharing granted when accepted today and checkbox is checked", () => {
    render(<PropertyAndConsentStep leadId={LEAD_ID} scanSessionId={SESSION_ID} />);
    fillBasics();
    fireEvent.click(
      screen.getByRole("radio", { name: /Yes — have someone call me today/i }),
    );
    fireEvent.click(contractorCheckbox());
    fireEvent.click(screen.getByRole("button", { name: /Save and continue/i }));

    expect(invokeMock).toHaveBeenCalledWith(
      "update-homeowner-context",
      expect.objectContaining({
        body: expect.objectContaining({
          handoff_consent_status: "accepted_today",
          consent: expect.objectContaining({
            events: expect.arrayContaining([
              expect.objectContaining({
                purpose: "contractor_sharing",
                decision: "granted",
              }),
            ]),
          }),
        }),
      }),
    );
  });

  it("submits report_only without contractor checkbox and sends contractor_sharing declined", () => {
    render(<PropertyAndConsentStep leadId={LEAD_ID} scanSessionId={SESSION_ID} />);
    fillBasics();
    fireEvent.click(
      screen.getByRole("radio", { name: /Not yet — I only want the report/i }),
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save and continue/i }));

    expect(invokeMock).toHaveBeenCalledWith(
      "update-homeowner-context",
      expect.objectContaining({
        body: expect.objectContaining({
          handoff_consent_status: "report_only",
          consent: expect.objectContaining({
            events: expect.arrayContaining([
              expect.objectContaining({
                purpose: "contractor_sharing",
                decision: "declined",
              }),
            ]),
          }),
        }),
      }),
    );
  });

  it("Skip sends contractor_sharing declined only without handoff status", async () => {
    render(<PropertyAndConsentStep leadId={LEAD_ID} scanSessionId={SESSION_ID} />);
    fireEvent.click(screen.getByRole("button", { name: /Skip for now/i }));

    expect(invokeMock).toHaveBeenCalledWith(
      "update-homeowner-context",
      expect.objectContaining({
        body: expect.objectContaining({
          consent: expect.objectContaining({
            events: expect.arrayContaining([
              expect.objectContaining({
                purpose: "contractor_sharing",
                decision: "declined",
              }),
            ]),
          }),
        }),
      }),
    );
    const body = invokeMock.mock.calls[0][1].body;
    expect(body.handoff_consent_status).toBeUndefined();
    expect(
      body.consent.events.some(
        (e: { decision: string }) => e.decision === "granted",
      ),
    ).toBe(false);
  });

  it("shows restriction copy about not sending quote back to issuing contractor", () => {
    render(<PropertyAndConsentStep leadId={LEAD_ID} scanSessionId={SESSION_ID} />);
    fireEvent.click(
      screen.getByRole("radio", { name: /Yes — have someone call me today/i }),
    );
    expect(
      screen.getByText(/does not authorize WindowMan to send my uploaded quote back/i),
    ).toBeInTheDocument();
  });
});

describe("PropertyAndConsentStep consent submission lifecycle", () => {
  const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  beforeEach(() => {
    invokeMock.mockReset();
  });

  function submissionIdOfCall(index: number): string {
    const body = invokeMock.mock.calls[index][1].body as {
      consent: { submissionId: string };
    };
    return body.consent.submissionId;
  }

  it("sends a real v4 UUID submissionId (no fixed fallback)", async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    render(<PropertyAndConsentStep leadId={LEAD_ID} scanSessionId={SESSION_ID} />);
    fillBasics();
    fireEvent.click(
      screen.getByRole("radio", { name: /Not yet — I only want the report/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Save and continue/i }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    const submissionId = submissionIdOfCall(0);
    expect(submissionId).toMatch(UUID_V4_REGEX);
    expect(submissionId).not.toMatch(/^00000000-0000-4000-8000-/);
  });

  it("keeps the same submissionId for an identical retry after a failure", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: new Error("temporary failure"),
    });
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

    render(<PropertyAndConsentStep leadId={LEAD_ID} scanSessionId={SESSION_ID} />);
    fillBasics();
    fireEvent.click(
      screen.getByRole("radio", { name: /Not yet — I only want the report/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Save and continue/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Save and continue/i }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));

    expect(submissionIdOfCall(1)).toBe(submissionIdOfCall(0));
  });

  it("generates a new submissionId when the contractor decision changes", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: new Error("temporary failure"),
    });
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

    render(<PropertyAndConsentStep leadId={LEAD_ID} scanSessionId={SESSION_ID} />);
    fillBasics();
    fireEvent.click(
      screen.getByRole("radio", { name: /Yes — have someone call me today/i }),
    );
    fireEvent.click(contractorCheckbox());

    fireEvent.click(screen.getByRole("button", { name: /Save and continue/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    // Changed decision: switch to report-only (contractor sharing declined).
    fireEvent.click(
      screen.getByRole("radio", { name: /Not yet — I only want the report/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Save and continue/i }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));

    const first = submissionIdOfCall(0);
    const second = submissionIdOfCall(1);
    expect(second).toMatch(UUID_V4_REGEX);
    expect(second).not.toBe(first);

    const firstBody = invokeMock.mock.calls[0][1].body as {
      consent: { events: Array<{ purpose: string; decision: string }> };
    };
    const secondBody = invokeMock.mock.calls[1][1].body as {
      consent: { events: Array<{ purpose: string; decision: string }> };
    };
    expect(firstBody.consent.events[0].decision).toBe("granted");
    expect(secondBody.consent.events[0].decision).toBe("declined");
  });
});
