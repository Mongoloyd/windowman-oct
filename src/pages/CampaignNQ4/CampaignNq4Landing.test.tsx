import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import CampaignNq4Page from "./CampaignNq4Page";
import {
  __resetNq4DocumentStateForTests,
  NQ4_ROBOTS_META_ID,
  NQ4_STYLE_ELEMENT_ID,
} from "./scopeNq4Css";

const {
  defaultSubmitterMock,
  navigateMock,
  setFunnelLeadIdMock,
  setFunnelPhoneMock,
  setFunnelQuoteFileIdMock,
  setFunnelScanSessionIdMock,
  setFunnelSessionIdMock,
  uploadZonePropsMock,
} = vi.hoisted(() => ({
  defaultSubmitterMock: vi.fn(),
  navigateMock: vi.fn(),
  setFunnelLeadIdMock: vi.fn(),
  setFunnelPhoneMock: vi.fn(),
  setFunnelQuoteFileIdMock: vi.fn(),
  setFunnelScanSessionIdMock: vi.fn(),
  setFunnelSessionIdMock: vi.fn(),
  uploadZonePropsMock: vi.fn(),
}));

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const NQ4_UPLOAD_RESUME_KEY = "wm_nq4_upload_resume_v1";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("./campaignNq4LeadCapture", () => ({
  createCampaignNq4LeadSubmitter: () => defaultSubmitterMock,
}));

vi.mock("@/components/AppTrackingProvider", () => ({
  AppTrackingProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/consentBanner", () => ({
  default: () => null,
}));

vi.mock("@/state/scanFunnel", () => ({
  ScanFunnelProvider: ({ children }: { children: ReactNode }) => children,
  useScanFunnelSafe: () => ({
    setLeadId: setFunnelLeadIdMock,
    setPhone: setFunnelPhoneMock,
    setQuoteFileId: setFunnelQuoteFileIdMock,
    setScanSessionId: setFunnelScanSessionIdMock,
    setSessionId: setFunnelSessionIdMock,
  }),
}));

vi.mock("@/components/UploadZone", () => ({
  default: (props: Record<string, unknown>) => {
    uploadZonePropsMock(props);
    return (
      <div
        data-testid="nq4-upload-zone"
        data-visible={props.isVisible ? "yes" : "no"}
        data-session-id={String(props.sessionId ?? "")}
        data-lead-id={String(props.leadId ?? "")}
      />
    );
  },
}));

vi.mock("@/pages/Index", () => ({
  default: () => <div>Home</div>,
}));

vi.mock("@/components/intake", () => ({
  WindowManIntakePreview: () => null,
}));

function renderPage(submitter = vi.fn()) {
  return render(<CampaignNq4Page onSubmitLead={submitter} />);
}

function openHeroIntake() {
  fireEvent.change(screen.getByTestId("nq4-hero-zip"), {
    target: { value: "33301" },
  });
  fireEvent.click(screen.getByTestId("nq4-check-area"));
  return screen.getByRole("dialog");
}

function advanceToContact() {
  const dialog = openHeroIntake();
  fireEvent.click(
    within(dialog).getByRole("radio", { name: "Impact windows" }),
  );
  fireEvent.click(within(dialog).getByRole("radio", { name: "6–10" }));
  fireEvent.click(
    within(dialog).getByRole("radio", { name: "1–3 months" }),
  );
  return dialog;
}

function advanceHasQuoteToContact() {
  fireEvent.click(screen.getByTestId("nq4-escape-hatch"));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
    target: { value: "33301" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  return dialog;
}

function fillContact(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText("First name"), {
    target: { value: " Maria " },
  });
  fireEvent.change(within(dialog).getByLabelText("Email address"), {
    target: { value: "Maria@Example.com" },
  });
  fireEvent.change(within(dialog).getByLabelText("Mobile number"), {
    target: { value: "3055550142" },
  });
}

function fillContactAndSubmit(dialog: HTMLElement, buttonName: string) {
  fillContact(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: buttonName }));
}

describe("CampaignNq4Landing", () => {
  describe("route-scoped stylesheet contract", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/pages/CampaignNQ4/nq4-landing.css"),
      "utf8",
    );

    it("keeps every rule scoped to the NQ4 route container", () => {
      const selectors = css
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .match(/([^{}]+)\{/g)
        ?.map((match) => match.slice(0, -1).trim())
        .filter((selector) => selector && !selector.startsWith("@")) ?? [];

      expect(selectors.length).toBeGreaterThan(50);
      for (const selectorList of selectors) {
        for (const selector of selectorList.split(",")) {
          expect(selector.trim()).toMatch(/^\.nq4-root/);
        }
      }
    });

    it("keeps @apply out of the raw-imported stylesheet", () => {
      expect(css).not.toContain("@apply");
    });

    it("declares every tactile elevation token as a multi-layer shadow", () => {
      for (const token of [
        "--nq4-elev-sm",
        "--nq4-elev-md",
        "--nq4-elev-lg",
        "--nq4-elev-accent",
        "--nq4-elev-accent-hover",
      ]) {
        const declaration = new RegExp(`${token}: ([^;]+);`).exec(css);
        expect(declaration, `${token} must be declared`).not.toBeNull();
        expect(declaration![1].split("),").length).toBeGreaterThanOrEqual(2);
      }
      for (const token of [
        "--nq4-edge-specular",
        "--nq4-edge-specular-strong",
        "--nq4-edge-recess",
      ]) {
        expect(css).toMatch(new RegExp(`${token}: inset `));
      }
    });

    it("elevates the previously flat content surfaces", () => {
      for (const selector of [
        "nq4-mech-card",
        "nq4-step",
        "nq4-compare-row",
        "nq4-panel",
      ]) {
        expect(css).toMatch(
          new RegExp(`\\.${selector} \\{[^}]*box-shadow: var\\(--nq4-elev-sm\\), var\\(--nq4-edge-specular\\)`),
        );
      }
    });

    it("gives controls a dark recess and never a background gradient", () => {
      for (const selector of ["nq4-zip-input", "nq4-intake-field input"]) {
        expect(css).toMatch(
          new RegExp(`\\.${selector} \\{[^}]*box-shadow: var\\(--nq4-edge-recess\\)`),
        );
        expect(css).not.toMatch(
          new RegExp(`\\.${selector} \\{[^}]*(background-image|background: linear-gradient)`),
        );
      }
    });

    it("preserves the selected-option left rail alongside its elevation", () => {
      expect(css).toMatch(
        /\.nq4-intake-option\.is-selected \{[^}]*box-shadow: inset 3px 0 0 var\(--nq4-primary\), var\(--nq4-elev-sm\)/,
      );
      expect(css).toMatch(
        /\.nq4-intake-option\.is-selected:hover \{[^}]*inset 3px 0 0 var\(--nq4-primary\)/,
      );
    });

    it("never lifts a disabled intake button", () => {
      expect(css).toMatch(/\.nq4-intake-primary:hover:not\(:disabled\)/);
      expect(css).not.toMatch(/\.nq4-intake-primary:hover \{/);
    });

    it("neutralizes every new transform under reduced motion", () => {
      const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css);
      expect(reduced).not.toBeNull();
      for (const selector of [
        ".nq4-cta:hover",
        ".nq4-zip-submit:hover",
        ".nq4-intake-option:hover",
        ".nq4-intake-primary:hover:not(:disabled)",
      ]) {
        expect(reduced![1]).toContain(selector);
      }
      expect(reduced![1]).toMatch(/transform: none/);
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/nq4");
    delete (window as Window & { dataLayer?: unknown[] }).dataLayer;
    __resetNq4DocumentStateForTests();
  });

  afterEach(() => {
    cleanup();
    __resetNq4DocumentStateForTests();
  });

  it("renders at the exact /nq4 route through the application router", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Give the next contractor a real number to beat.",
      }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/nq4");
  });

  it("mounts scoped styles and runtime noindex metadata only for its lifetime", () => {
    const { unmount } = renderPage();

    expect(document.getElementById(NQ4_STYLE_ELEMENT_ID)).toBeInTheDocument();
    expect(document.getElementById(NQ4_ROBOTS_META_ID)).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );

    unmount();

    expect(document.getElementById(NQ4_STYLE_ELEMENT_ID)).not.toBeInTheDocument();
    expect(document.getElementById(NQ4_ROBOTS_META_ID)).not.toBeInTheDocument();
  });

  it("uses an accessible inline ZIP form and leaves the footer CTA intact", () => {
    renderPage();
    const hero = screen
      .getByRole("heading", {
        level: 1,
        name: "Give the next contractor a real number to beat.",
      })
      .closest("section");
    if (!(hero instanceof HTMLElement)) {
      throw new Error("Expected the NQ4 hero section.");
    }

    const zipInput = within(hero).getByLabelText("Florida ZIP code");
    expect(zipInput).toHaveAttribute("type", "text");
    expect(zipInput).toHaveAttribute("inputmode", "numeric");
    expect(zipInput).toHaveAttribute("maxlength", "5");
    expect(zipInput).toHaveAttribute("autocomplete", "postal-code");
    expect(within(hero).getByTestId("nq4-check-area")).toHaveTextContent(
      "Check My Area",
    );
    expect(screen.getByTestId("nq4-cta-footer")).toHaveTextContent(
      "Build My Number to Beat",
    );
  });

  it("states the no-estimate-needed hero copy and support line", () => {
    renderPage();
    expect(
      screen.getByText(
        "No estimate yet? Start here. WindowMan helps you get a first written estimate, then checks the price, scope, fees, warranty, and fine print — turning it into your Number to Beat.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "No estimate needed to start · WindowMan doesn't sell or install windows · No obligation",
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole("heading", {
        name: "See what WindowMan will check when your first estimate arrives.",
      }),
    ).toBeInTheDocument();
  });

  it("opens the written-estimate handoff as a button without changing /nq4 or its query", () => {
    window.history.replaceState(
      {},
      "",
      "/nq4?utm_source=partner&gclid=test-click",
    );
    renderPage();
    const escapeHatch = screen.getByTestId("nq4-escape-hatch");

    expect(escapeHatch.tagName).toBe("BUTTON");
    expect(escapeHatch).toHaveAttribute("type", "button");
    expect(escapeHatch).not.toHaveAttribute("href");
    expect(escapeHatch).toHaveTextContent(
      "Already have a written estimate? Upload it for an AI check",
    );

    fireEvent.click(escapeHatch);

    expect(window.location.pathname).toBe("/nq4");
    expect(window.location.search).toBe(
      "?utm_source=partner&gclid=test-click",
    );
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", {
        name: "Where is the project?",
      }),
    ).toBeInTheDocument();
  });

  it("starts has_quote at location, skips project questions, and preserves hero attribution", async () => {
    const submitter = vi.fn().mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      reused: false,
    });
    renderPage(submitter);
    fireEvent.click(screen.getByTestId("nq4-escape-hatch"));
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).getByRole("progressbar", { name: "Step 1 of 2" }),
    ).toHaveAttribute("aria-valuenow", "1");
    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "33301" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(
      within(dialog).getByRole("heading", { name: "Your estimate is next." }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Add your contact details, then upload your written estimate on this page.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Continue to Upload" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("heading", { name: "What are you replacing?" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("heading", { name: "Roughly how many openings?" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("heading", { name: "When are you hoping to start?" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("progressbar", { name: "Step 2 of 2" }),
    ).toHaveAttribute("aria-valuenow", "2");
    expect(within(dialog).getByText("Step 2")).toBeInTheDocument();

    fillContactAndSubmit(dialog, "Continue to Upload");

    await waitFor(() =>
      expect(submitter).toHaveBeenCalledWith(
        {
          intent: "has_quote",
          zip: "33301",
          projectType: "",
          openings: "",
          name: "Maria",
          email: "maria@example.com",
          phone: "+13055550142",
        },
        expect.objectContaining({
          captureAttemptId: expect.any(String),
          landingVisitId: expect.any(String),
          entryPoint: "hero_primary",
        }),
      ),
    );
  });

  it("deduplicates rapid written-estimate activations until the intake closes", async () => {
    renderPage();
    const opener = screen.getByTestId("nq4-escape-hatch");

    fireEvent.click(opener);
    fireEvent.click(opener);

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    fireEvent.click(opener);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("keeps the uploader hidden through failure and success, then reveals exact persisted IDs after focus restoration", async () => {
    const submitter = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: "Try again." })
      .mockResolvedValueOnce({
        ok: true,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        reused: false,
      });
    renderPage(submitter);
    const opener = screen.getByTestId("nq4-escape-hatch");
    opener.focus();
    const focusSpy = vi.spyOn(opener, "focus");
    const dialog = advanceHasQuoteToContact();
    const uploadSection = document.querySelector<HTMLElement>(
      "section[data-campaign-shared-ui]",
    );

    expect(uploadSection).toHaveAttribute("hidden");
    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    fillContactAndSubmit(dialog, "Continue to Upload");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Try again.",
    );
    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    expect(uploadSection).toHaveAttribute("hidden");
    expect(window.sessionStorage.getItem(NQ4_UPLOAD_RESUME_KEY)).toBeNull();
    expect(setFunnelLeadIdMock).not.toHaveBeenCalled();
    expect(setFunnelSessionIdMock).not.toHaveBeenCalled();
    expect(setFunnelScanSessionIdMock).not.toHaveBeenCalled();
    expect(setFunnelQuoteFileIdMock).not.toHaveBeenCalled();
    expect(setFunnelPhoneMock).not.toHaveBeenCalled();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Continue to Upload" }),
    );
    expect(
      await within(dialog).findByRole("heading", { name: "Ready to upload." }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Your details are saved. Upload your written estimate to start the check.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    expect(uploadSection).toHaveAttribute("hidden");
    expect(
      JSON.parse(
        window.sessionStorage.getItem(NQ4_UPLOAD_RESUME_KEY) ?? "null",
      ),
    ).toMatchObject({
      version: 1,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
    });
    expect(setFunnelLeadIdMock).toHaveBeenCalledOnce();
    expect(setFunnelLeadIdMock).toHaveBeenCalledWith(LEAD_ID);
    expect(setFunnelSessionIdMock).toHaveBeenCalledOnce();
    expect(setFunnelSessionIdMock).toHaveBeenCalledWith(SESSION_ID);
    expect(setFunnelScanSessionIdMock).toHaveBeenCalledOnce();
    expect(setFunnelScanSessionIdMock).toHaveBeenCalledWith(null);
    expect(setFunnelQuoteFileIdMock).toHaveBeenCalledOnce();
    expect(setFunnelQuoteFileIdMock).toHaveBeenCalledWith(null);
    expect(setFunnelPhoneMock).toHaveBeenCalledTimes(2);
    expect(setFunnelPhoneMock).toHaveBeenNthCalledWith(1, "", "none");
    expect(setFunnelPhoneMock).toHaveBeenNthCalledWith(
      2,
      "+13055550142",
      "screened_valid",
    );
    expect(setFunnelPhoneMock.mock.invocationCallOrder[0])
      .toBeLessThan(setFunnelLeadIdMock.mock.invocationCallOrder[0]);

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Upload My Estimate" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
        "data-visible",
        "yes",
      ),
    );
    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-lead-id",
      LEAD_ID,
    );
    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-session-id",
      SESSION_ID,
    );
    expect(uploadSection).not.toHaveAttribute("hidden");
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    await waitFor(() => expect(opener).toHaveFocus());

    const visibleCallIndex = uploadZonePropsMock.mock.calls.findIndex(
      ([props]) => (props as { isVisible?: boolean }).isVisible === true,
    );
    const focusInvocationOrder = focusSpy.mock.invocationCallOrder.at(-1);
    const revealInvocationOrder =
      uploadZonePropsMock.mock.invocationCallOrder[visibleCallIndex];
    expect(visibleCallIndex).toBeGreaterThanOrEqual(0);
    expect(focusInvocationOrder).toBeLessThan(revealInvocationOrder);
  });

  it("keeps the upload section hidden when intake is cancelled and cancels pending focus work on unmount", () => {
    const { unmount } = renderPage();
    fireEvent.click(screen.getByTestId("nq4-escape-hatch"));
    const dialog = screen.getByRole("dialog");
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(917);
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("section[data-campaign-shared-ui]"))
      .toHaveAttribute("hidden");
    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    unmount();
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(917);

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("restores only a valid, unexpired NQ4 upload handoff on remount", async () => {
    window.sessionStorage.setItem(
      NQ4_UPLOAD_RESUME_KEY,
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: Date.now() + 60_000,
      }),
    );
    const firstRender = renderPage();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-visible",
      "yes",
    );
    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-lead-id",
      LEAD_ID,
    );
    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-session-id",
      SESSION_ID,
    );
    await waitFor(() => {
      expect(setFunnelLeadIdMock).toHaveBeenCalledWith(LEAD_ID);
      expect(setFunnelSessionIdMock).toHaveBeenCalledWith(SESSION_ID);
      expect(setFunnelScanSessionIdMock).toHaveBeenCalledWith(null);
      expect(setFunnelQuoteFileIdMock).toHaveBeenCalledWith(null);
    });
    expect(setFunnelPhoneMock).toHaveBeenCalledOnce();
    expect(setFunnelPhoneMock).toHaveBeenCalledWith("", "none");
    expect(setFunnelPhoneMock.mock.invocationCallOrder[0])
      .toBeLessThan(setFunnelLeadIdMock.mock.invocationCallOrder[0]);
    firstRender.unmount();

    window.sessionStorage.setItem(
      NQ4_UPLOAD_RESUME_KEY,
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: Date.now() - 1,
      }),
    );
    renderPage();

    expect(screen.getByTestId("nq4-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    expect(window.sessionStorage.getItem(NQ4_UPLOAD_RESUME_KEY)).toBeNull();
  });

  it("clears the resume hint and navigates to the fresh classic report on scan start", () => {
    window.sessionStorage.setItem(
      NQ4_UPLOAD_RESUME_KEY,
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: Date.now() + 60_000,
      }),
    );
    renderPage();
    const uploadProps = uploadZonePropsMock.mock.calls.at(-1)?.[0] as {
      onScanStart?: (fileName: string, scanSessionId: string) => void;
    };

    uploadProps.onScanStart?.(
      "private-estimate.pdf",
      "33333333-3333-4333-8333-333333333333",
    );

    expect(window.sessionStorage.getItem(NQ4_UPLOAD_RESUME_KEY)).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith(
      "/report/classic/33333333-3333-4333-8333-333333333333",
      { state: { freshScan: true } },
    );
  });

  it("does not add contact PII to dataLayer during the upload handoff", async () => {
    const dataLayer = [{ event: "existing-marker" }];
    Object.assign(window, { dataLayer });
    const submitter = vi.fn().mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      reused: false,
    });
    renderPage(submitter);
    const dialog = advanceHasQuoteToContact();

    fillContactAndSubmit(dialog, "Continue to Upload");
    expect(
      await within(dialog).findByRole("heading", { name: "Ready to upload." }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Upload My Estimate" }),
    );

    expect(dataLayer).toEqual([{ event: "existing-marker" }]);
    expect(JSON.stringify(dataLayer)).not.toMatch(
      /Maria|maria@example\.com|3055550142|\+13055550142/,
    );
  });

  it.each(["", "12345"])(
    "rejects invalid hero ZIP %j without opening the intake",
    (zip) => {
      renderPage();
      const zipInput = screen.getByTestId("nq4-hero-zip");
      fireEvent.change(zipInput, { target: { value: zip } });

      fireEvent.click(screen.getByTestId("nq4-check-area"));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a valid 5-digit Florida ZIP code.",
      );
      expect(zipInput).toHaveAttribute("aria-invalid", "true");
      expect(zipInput).toHaveFocus();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("opens at product, preserves ZIP for Back, and exposes accessible progress", () => {
    renderPage();
    const dialog = openHeroIntake();

    expect(
      within(dialog).getByRole("heading", {
        name: "What are you replacing?",
      }),
    ).toBeInTheDocument();
    const progress = within(dialog).getByRole("progressbar", {
      name: "Step 2 of 5",
    });
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "5");
    expect(progress).toHaveAttribute("aria-valuenow", "2");
    expect(progress).toHaveAttribute(
      "aria-valuetext",
      "Step 2 of 5, current step",
    );
    expect(progress).toHaveAttribute("aria-busy", "false");
    expect(progress.querySelectorAll("span")).toHaveLength(5);

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));

    expect(
      within(dialog).getByRole("heading", { name: "Where is the project?" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Florida project ZIP code")).toHaveValue(
      "33301",
    );
  });

  it("advances each single-choice step on one activation without a Continue button", () => {
    renderPage();
    const dialog = openHeroIntake();

    expect(
      within(dialog).queryByRole("button", { name: "Continue" }),
    ).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Impact doors" }),
    );
    const openingsHeading = within(dialog).getByRole("heading", {
      name: "Roughly how many openings?",
    });
    expect(openingsHeading).toBeInTheDocument();
    expect(openingsHeading).toHaveFocus();
    expect(
      within(dialog).queryByRole("button", { name: "Continue" }),
    ).toBeNull();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Not sure" }));
    const timingHeading = within(dialog).getByRole("heading", {
      name: "When are you hoping to start?",
    });
    expect(timingHeading).toBeInTheDocument();
    expect(timingHeading).toHaveFocus();
    expect(
      within(dialog).queryByRole("button", { name: "Continue" }),
    ).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Planning ahead" }),
    );

    expect(
      within(dialog).getByRole("heading", {
        name: "Save your project request",
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("progressbar", { name: "Step 5 of 5" }),
    ).toHaveAttribute("aria-valuenow", "5");
  });

  it("preserves contact disclosure and explicit consent construction copy", () => {
    renderPage();
    const dialog = advanceToContact();

    expect(
      within(dialog).getByText(
        "WindowMan won’t share your details with contractors unless you later ask for an introduction.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("No contractor list. No marketing consent."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("First name")).toBeRequired();
    expect(within(dialog).getByLabelText("Email address")).toBeRequired();
    expect(within(dialog).getByLabelText("Mobile number")).toBeRequired();
    expect(
      within(dialog).getByText(
        "By continuing, you authorize WindowMan to contact you regarding this estimate request via call, email, or text (msg/data rates apply, reply STOP to opt out). We do not sell your data to contractor lists.",
      ),
    ).toBeInTheDocument();
  });

  it("waits for persisted IDs, submits once, then shows confirmed success", async () => {
    let resolveSubmit!: (result: {
      ok: true;
      leadId: string;
      sessionId: string;
      reused: boolean;
    }) => void;
    const submitter = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderPage(submitter);
    const dialog = advanceToContact();
    fillContact(dialog);

    const submitButton = within(dialog).getByRole("button", {
      name: "Save My Project Request",
    });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitter).toHaveBeenCalledTimes(1));
    expect(submitter).toHaveBeenCalledWith(
      {
        zip: "33301",
        projectType: "Impact windows",
        openings: "6–10",
        timing: "1–3 months",
        name: "Maria",
        email: "maria@example.com",
        phone: "+13055550142",
      },
      expect.objectContaining({
        captureAttemptId: expect.any(String),
        landingVisitId: expect.any(String),
        entryPoint: "hero_zip",
      }),
    );
    expect(
      within(dialog).getByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByTestId("nq4-intake-progress"),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByTestId("nq4-success")).not.toBeInTheDocument();

    resolveSubmit({
      ok: true,
      leadId: "lead-123",
      sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      reused: false,
    });

    const success = await screen.findByTestId("nq4-success");
    expect(
      within(success).getByText("Project request received"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["lead ID", "", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"],
    ["session ID", "lead-123", ""],
  ])("fails closed when persistence omits the %s", async (_label, leadId, sessionId) => {
    const submitter = vi.fn().mockResolvedValue({
      ok: true,
      leadId,
      sessionId,
      reused: false,
    });
    renderPage(submitter);
    const dialog = advanceToContact();
    fillContact(dialog);

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Save My Project Request",
      }),
    );

    expect(
      await within(dialog).findByText(
        "We couldn't submit your request. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("nq4-success")).not.toBeInTheDocument();
  });

  it("allows retry after a safe persistence failure", async () => {
    const submitter = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        message: "We couldn't submit your request. Please try again.",
      })
      .mockResolvedValueOnce({
        ok: true,
        leadId: "lead-retry",
        sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        reused: false,
      });
    renderPage(submitter);
    const dialog = advanceToContact();
    fillContact(dialog);

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Save My Project Request",
      }),
    );
    expect(
      await within(dialog).findByText(
        "We couldn't submit your request. Please try again.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Save My Project Request",
      }),
    );

    expect(await screen.findByTestId("nq4-success")).toBeInTheDocument();
    expect(submitter).toHaveBeenCalledTimes(2);
  });

  it("opens the footer CTA on the location step", () => {
    renderPage();

    fireEvent.click(screen.getByTestId("nq4-cta-footer"));
    const dialog = screen.getByRole("dialog");

    expect(
      within(dialog).getByRole("heading", { name: "Where is the project?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("progressbar", { name: "Step 1 of 5" }),
    ).toHaveAttribute("aria-valuenow", "1");
    expect(within(dialog).getByLabelText("Florida project ZIP code")).toHaveValue("");
  });
});
