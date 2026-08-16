import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PowerToolFlow, {
  buildPowerToolEntryQueryParams,
  isTrustedPowerToolCreateResult,
} from "./PowerToolDemo";

const { capturePowerToolDemoLeadMock } = vi.hoisted(() => ({
  capturePowerToolDemoLeadMock: vi.fn(),
}));

vi.mock("@/lib/capturePowerToolDemoLead", () => ({
  capturePowerToolDemoLead: capturePowerToolDemoLeadMock,
}));

vi.mock("@/hooks/useTickerStats", () => ({
  useTickerStats: () => ({ total: 0 }),
}));

const LEAD_ID = "99999999-8888-4777-8666-555555555555";

describe("PowerToolDemo wmchat entry", () => {
  beforeEach(() => {
    capturePowerToolDemoLeadMock.mockReset();
    vi.stubGlobal("scrollTo", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("adds only wm_chat entry attribution while preserving the canonical demo source", async () => {
    capturePowerToolDemoLeadMock.mockImplementation(async (payload) => ({
      ok: true,
      leadId: LEAD_ID,
      sessionId: payload.session_id,
      source: "power-tool-demo",
    }));

    render(<PowerToolFlow triggerOpen entrySource="wm_chat" />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Sarah"), {
      target: { value: "Maria" },
    });
    fireEvent.change(screen.getByPlaceholderText("sarah@email.com"), {
      target: { value: "Maria@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock the Sample Audit" }));

    await waitFor(() => expect(capturePowerToolDemoLeadMock).toHaveBeenCalledTimes(1));
    expect(capturePowerToolDemoLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        source: "power-tool-demo",
        client_slug: "direct",
        first_name: "Maria",
        email: "maria@example.com",
        query_params: {
          entry_point: "wm_chat",
        },
      }),
    );
    const payload = capturePowerToolDemoLeadMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("wmchat_lead_id");
    expect(payload).not.toHaveProperty("wmchat_session_id");
  });

  it("keeps direct callers byte-compatible at the attribution boundary", () => {
    expect(buildPowerToolEntryQueryParams()).toBeUndefined();
    expect(buildPowerToolEntryQueryParams("direct")).toBeUndefined();
    expect(buildPowerToolEntryQueryParams("wm_chat")).toEqual({
      entry_point: "wm_chat",
    });
  });

  it("rejects a successful response unless the real lead and session pair match", () => {
    const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(
      isTrustedPowerToolCreateResult(
        {
          ok: true,
          leadId: LEAD_ID,
          sessionId,
          source: "power-tool-demo",
        },
        sessionId,
      ),
    ).toBe(true);
    expect(
      isTrustedPowerToolCreateResult(
        {
          ok: true,
          leadId: LEAD_ID,
          sessionId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
          source: "power-tool-demo",
        },
        sessionId,
      ),
    ).toBe(false);
    expect(
      isTrustedPowerToolCreateResult(
        {
          ok: true,
          leadId: LEAD_ID,
          sessionId,
          source: "windowman-first-quote",
        },
        sessionId,
      ),
    ).toBe(false);
    expect(
      isTrustedPowerToolCreateResult(
        {
          ok: true,
          leadId: "00000000-0000-0000-0000-000000000000",
          sessionId,
          source: "power-tool-demo",
        },
        sessionId,
      ),
    ).toBe(false);
  });

  it("coalesces rapid duplicate demo submits and releases the guard after completion", async () => {
    let resolveFirstRequest: (value: unknown) => void = () => undefined;
    const firstRequest = new Promise((resolve) => {
      resolveFirstRequest = resolve;
    });
    capturePowerToolDemoLeadMock
      .mockReturnValueOnce(firstRequest)
      .mockImplementation(async (payload) => ({
        ok: true,
        leadId: LEAD_ID,
        sessionId: payload.session_id,
        source: "power-tool-demo",
      }));

    render(<PowerToolFlow triggerOpen entrySource="wm_chat" />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Sarah"), {
      target: { value: "Maria" },
    });
    fireEvent.change(screen.getByPlaceholderText("sarah@email.com"), {
      target: { value: "maria@example.com" },
    });
    const submit = screen.getByRole("button", { name: "Unlock the Sample Audit" });

    act(() => {
      fireEvent.click(submit);
      fireEvent.click(submit);
    });
    expect(capturePowerToolDemoLeadMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstRequest({ ok: false });
      await firstRequest;
    });
    await screen.findByText("We could not save that yet. Please try again.");

    fireEvent.click(screen.getByRole("button", { name: "Unlock the Sample Audit" }));
    await waitFor(() => expect(capturePowerToolDemoLeadMock).toHaveBeenCalledTimes(2));
    expect(capturePowerToolDemoLeadMock.mock.calls[1][0].session_id).toBe(
      capturePowerToolDemoLeadMock.mock.calls[0][0].session_id,
    );
  });

  it("omits entry attribution for the default direct modal", async () => {
    capturePowerToolDemoLeadMock.mockImplementation(async (payload) => ({
      ok: true,
      leadId: LEAD_ID,
      sessionId: payload.session_id,
      source: "power-tool-demo",
    }));

    render(<PowerToolFlow triggerOpen />);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Sarah"), {
      target: { value: "Maria" },
    });
    fireEvent.change(screen.getByPlaceholderText("sarah@email.com"), {
      target: { value: "maria@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock the Sample Audit" }));

    await waitFor(() => expect(capturePowerToolDemoLeadMock).toHaveBeenCalledTimes(1));
    expect(capturePowerToolDemoLeadMock.mock.calls[0][0]).not.toHaveProperty(
      "query_params",
    );
  });
});
