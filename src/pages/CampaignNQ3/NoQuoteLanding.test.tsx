import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import NoQuoteLanding from "./NoQuoteLanding";
import { scopeNq3Css } from "./scopeNq3Css";

const {
  defaultSubmitMock,
  navigateMock,
  setFunnelLeadIdMock,
  setFunnelPhoneMock,
  setFunnelQuoteFileIdMock,
  setFunnelScanSessionIdMock,
  setFunnelSessionIdMock,
  uploadZonePropsMock,
} = vi.hoisted(() => ({
  defaultSubmitMock: vi.fn(),
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
const NQ3_UPLOAD_RESUME_KEY = "wm_nq3_upload_resume_v1";
const SHARED_UI_EXCLUSION =
  ":not(:where([data-campaign-shared-ui])):not(:where([data-campaign-shared-ui] *))";
const NQ3_PAGE_SELECTOR = '[data-page="campaign-nq3"]';

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("./campaignNq3LeadCapture", () => ({
  createCampaignNq3LeadSubmitter: () =>
    (...args: unknown[]) => defaultSubmitMock(...args),
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

vi.mock("@/pages/Index", () => ({
  default: () => <div>Home</div>,
}));

vi.mock("@/components/UploadZone", () => ({
  default: (props: Record<string, unknown>) => {
    uploadZonePropsMock(props);
    return (
      <div
        data-testid="nq3-upload-zone"
        data-visible={props.isVisible ? "yes" : "no"}
        data-session-id={String(props.sessionId ?? "")}
        data-lead-id={String(props.leadId ?? "")}
      />
    );
  },
}));

function renderPage(onSubmitLead?: Parameters<typeof NoQuoteLanding>[0]["onSubmitLead"]) {
  return render(
    <HelmetProvider>
      <NoQuoteLanding onSubmitLead={onSubmitLead} />
    </HelmetProvider>,
  );
}

function advanceToContactStep() {
  fireEvent.click(screen.getByRole("button", { name: "Start My Check" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
    target: { value: "34997" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "Impact windows" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "6–10" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "Not sure" }));
  return dialog;
}

function advanceHasQuoteToContactStep() {
  fireEvent.click(screen.getByTestId("nq3-escape-hatch"));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
    target: { value: "34997" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  return dialog;
}

function fillContactAndSubmit(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText("First name"), {
    target: { value: "Sam" },
  });
  fireEvent.change(within(dialog).getByLabelText("Email address"), {
    target: { value: "sam@example.com" },
  });
  fireEvent.change(within(dialog).getByLabelText("Mobile number"), {
    target: { value: "3055550142" },
  });
  fireEvent.click(within(dialog).getByTestId("nq3-intake-submit"));
}

describe("CampaignNQ3 NoQuoteLanding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/nq3");
    delete (window as Window & { dataLayer?: unknown[] }).dataLayer;
    defaultSubmitMock.mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      reused: false,
    });
  });

  it("renders at the exact /nq3 route through the application router", async () => {
    window.history.replaceState({}, "", "/nq3");
    render(<App />);

    expect(await screen.findByRole("heading", {
      level: 1,
      name: "Don't just get a window estimate. Get one that's been checked.",
    })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/nq3");
  });

  describe("route-scoped stylesheet contract", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/pages/CampaignNQ3/nq-landing.css"),
      "utf8",
    );
    const scoped = scopeNq3Css(css);

    it("keeps every rule scoped to the NQ3 route container", () => {
      const selectors = scoped
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .match(/([^{}]+)\{/g)
        ?.map((match) => match.slice(0, -1).trim())
        .filter((selector) => selector && !selector.startsWith("@")) ?? [];

      expect(selectors.length).toBeGreaterThan(50);
      for (const selectorList of selectors) {
        for (const selector of selectorList.split(",")) {
          expect(selector.trim()).toMatch(/^\[data-page="campaign-nq3"\]/);
        }
      }
    });

    it("introduces no unscoped global form, button, or input rules", () => {
      expect(scoped).not.toMatch(/(^|[},])\s*(button|input|select|form|body|html)\s*[,{]/);
    });

    it("retains the intake modal selectors the skin depends on", () => {
      for (const selector of [
        ".overlay",
        ".modal",
        ".modal-top",
        ".modal-body",
        ".prog",
        ".prog-copy",
        ".m-kicker",
        ".m-close",
        ".m-back",
        ".opts",
        ".opt",
      ]) {
        expect(css).toContain(selector);
      }
    });

    it("stacks intake options in a single full-width column", () => {
      expect(css).toMatch(/\.opts\{[^}]*flex-direction:column/);
      expect(css).not.toMatch(/\.opts\{[^}]*grid-template-columns:1fr 1fr/);
    });

    it("keeps unrelated landing sections and their classes intact", () => {
      for (const selector of [
        ".hero",
        ".nav-in",
        ".steps",
        ".checks",
        ".findings",
        ".faq",
        ".final",
        "footer",
        ".disclaimer",
      ]) {
        expect(css).toContain(selector);
      }
    });

    it("declares every tactile elevation token as a multi-layer shadow", () => {
      for (const token of ["--elev-sm", "--elev-md", "--elev-lg", "--elev-accent", "--elev-accent-hover"]) {
        const declaration = new RegExp(`${token}:([^;]+);`).exec(css);
        expect(declaration, `${token} must be declared`).not.toBeNull();
        expect(declaration![1].split("),").length).toBeGreaterThanOrEqual(2);
      }
      for (const token of ["--edge-specular", "--edge-specular-strong", "--edge-recess"]) {
        expect(css).toMatch(new RegExp(`${token}:inset `));
      }
    });

    it("keeps @apply out of the raw-imported stylesheet", () => {
      expect(css).not.toContain("@apply");
    });

    /**
     * A brace inside a comment used to split the comment in half: the first fragment was
     * prefixed as if it were a selector and the closing brace terminated a rule that was
     * never opened, silently discarding every declaration that followed — including the
     * custom property block, which took the entire page theme with it.
     */
    it("cannot be corrupted by a brace inside a comment", () => {
      const scopedWithComment = scopeNq3Css(
        "/* discussing a{b:c} rule */:root{--x:1px}section{padding:var(--x)}",
      );

      expect(scopedWithComment).toContain(
        `${NQ3_PAGE_SELECTOR}${SHARED_UI_EXCLUSION}{--x:1px}`,
      );
      expect(scopedWithComment).toContain(
        `${NQ3_PAGE_SELECTOR} section${SHARED_UI_EXCLUSION}{padding:var(--x)}`,
      );
      expect(scopedWithComment).not.toContain("discussing");
    });

    it("excludes the shared upload boundary and its descendants from every qualified selector", () => {
      const scopedBoundary = scopeNq3Css(
        ":root{--x:1px}*{box-sizing:border-box}section,input::placeholder{padding:0}@media(max-width:560px){button:hover{opacity:1}}",
      );

      expect(scopedBoundary).toContain(
        `${NQ3_PAGE_SELECTOR}${SHARED_UI_EXCLUSION}{--x:1px}`,
      );
      expect(scopedBoundary).toContain(
        `${NQ3_PAGE_SELECTOR}${SHARED_UI_EXCLUSION},${NQ3_PAGE_SELECTOR} *${SHARED_UI_EXCLUSION}{box-sizing:border-box}`,
      );
      expect(scopedBoundary).toContain(
        `${NQ3_PAGE_SELECTOR} section${SHARED_UI_EXCLUSION},${NQ3_PAGE_SELECTOR} input${SHARED_UI_EXCLUSION}::placeholder{padding:0}`,
      );
      expect(scopedBoundary).toContain(
        `@media(max-width:560px){${NQ3_PAGE_SELECTOR} button:hover${SHARED_UI_EXCLUSION}{opacity:1}}`,
      );
      expect(scopedBoundary).not.toContain("!important");
    });

    it("still resolves the custom property block after scoping the real stylesheet", () => {
      // The token block is what every colour, contrast, and atmospheric value depends on.
      const rootRuleStart = `${NQ3_PAGE_SELECTOR}${SHARED_UI_EXCLUSION}{`;
      const rootRuleIndex = scoped.indexOf(rootRuleStart);
      const rootRule = scoped.slice(
        rootRuleIndex,
        scoped.indexOf("}", rootRuleIndex) + 1,
      );

      expect(rootRuleIndex).toBeGreaterThanOrEqual(0);
      expect(rootRule).toContain("--txt-3:");
      expect(rootRule).toContain("--atmo-grid-size:");
    });

    it("gives controls a dark recess and never a background gradient", () => {
      expect(css).toMatch(/\.zip-form\{[^}]*box-shadow:var\(--elev-md\), ?var\(--edge-recess\)/);
      expect(css).toMatch(/\.field input,\.field select\{[^}]*box-shadow:var\(--edge-recess\)/);
      expect(css).not.toMatch(/\.field input,\.field select\{[^}]*background-image/);
      expect(css).not.toMatch(/\.field input,\.field select\{[^}]*background:linear-gradient/);
    });

    it("elevates static content cards without giving them a hover lift", () => {
      expect(css).toMatch(/\.chk\{[^}]*box-shadow:var\(--elev-sm\)/);
      expect(css).toMatch(/\.finding\{[^}]*box-shadow:var\(--elev-sm\)/);
      expect(css).not.toMatch(/\.chk:hover/);
      expect(css).not.toMatch(/\.finding:hover/);
    });

    it("lifts the primary CTA on hover and presses it on active", () => {
      expect(css).toMatch(/\.btn-primary:hover\{[^}]*transform:translateY\(var\(--lift\)\)/);
      expect(css).toMatch(/\.btn-primary:active\{[^}]*transform:translateY\(1px\)/);
      expect(css.indexOf(".btn-primary:active")).toBeGreaterThan(css.indexOf(".btn-primary:hover"));
    });

    it("neutralizes every new transform under reduced motion", () => {
      const reduced = /@media \(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/.exec(css);
      expect(reduced).not.toBeNull();
      for (const selector of [".btn-primary:hover", ".btn-ghost:hover", ".opt:hover", ".step:hover"]) {
        expect(reduced![1]).toContain(selector);
      }
      expect(reduced![1]).toMatch(/transform:none/);
    });
  });

  it("renders the modular landing sections, real legal links, and route-lifecycle CSS", () => {
    const { container, unmount } = renderPage();
    expect(screen.getByRole("heading", { level: 1, name: /Don't just get a window estimate/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "One estimate isn't a price. It's an opening offer." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The parts of an estimate people skim." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Specific, sourced, and worth asking about." })).toBeInTheDocument();
    expect(screen.getByText("Illustrative examples — not real estimates")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Disclaimer" })).toHaveAttribute("href", "/disclaimer");
    const routeStyles = container.querySelector("style[data-nq3-landing-styles]");
    expect(routeStyles).toBeInTheDocument();
    expect(scopeNq3Css("section{padding:1px}@media(max-width:1px){nav{top:0}}"))
      .toBe(
        `${NQ3_PAGE_SELECTOR} section${SHARED_UI_EXCLUSION}{padding:1px}` +
        `@media(max-width:1px){${NQ3_PAGE_SELECTOR} nav${SHARED_UI_EXCLUSION}{top:0}}`,
      );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    expect(document.querySelector("style[data-nq3-landing-styles]")).not.toBeInTheDocument();
  });

  it("exposes both ZIP fields through a persistent visible label", () => {
    const { container } = renderPage();
    const zipInputs = screen.getAllByLabelText("Florida ZIP code");

    expect(zipInputs).toHaveLength(2);
    expect(zipInputs[0]).toHaveAttribute("id", "nq3-hero-zip");
    expect(zipInputs[1]).toHaveAttribute("id", "nq3-final-zip");
    for (const id of ["nq3-hero-zip", "nq3-final-zip"]) {
      const label = container.querySelector(`label[for="${id}"]`);
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("Florida ZIP code");
      expect(label).toHaveClass("zip-label");
    }
  });

  it("renders the exact hero, footer, and navigation CTA labels", () => {
    renderPage();
    expect(
      screen.getAllByRole("button", { name: /Start My Free Estimate Check/ }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Start My Check" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Get My Free AI Report/ }),
    ).not.toBeInTheDocument();
  });

  it("recomposes the hero reassurance row without repeating the footer wording", () => {
    const { container } = renderPage();
    const heroTrust = container.querySelector(".hero .microtrust");

    expect(heroTrust?.textContent).toBe(
      "No estimate needed to startFlorida projects onlyFree · no obligation",
    );
  });

  it("opens the written-estimate handoff as a button without changing /nq3 or its query", () => {
    window.history.replaceState({}, "", "/nq3?utm_source=partner&gclid=test-click");
    renderPage();
    const escapeHatch = screen.getByTestId("nq3-escape-hatch");

    expect(escapeHatch.tagName).toBe("BUTTON");
    expect(escapeHatch).toHaveAttribute("type", "button");
    expect(escapeHatch).not.toHaveAttribute("href");
    expect(escapeHatch).toHaveTextContent(
      "Already have a written estimate? Upload it for an AI check",
    );

    fireEvent.click(escapeHatch);

    expect(window.location.pathname).toBe("/nq3");
    expect(window.location.search).toBe("?utm_source=partner&gclid=test-click");
    expect(
      within(screen.getByRole("dialog")).getByRole("heading", {
        name: "Where's the project?",
      }),
    ).toBeInTheDocument();
  });

  it("starts has_quote at location, skips project questions, and preserves hero attribution", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      reused: false,
    });
    renderPage(onSubmitLead);
    const dialog = advanceHasQuoteToContactStep();

    expect(
      within(dialog).getByRole("heading", { name: "Your estimate is next." }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Add your contact details, then upload your written estimate on this page.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("nq3-intake-submit")).toHaveTextContent(
      "Continue to Upload",
    );
    expect(
      within(dialog).queryByRole("heading", { name: "What are you replacing?" }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByTestId("nq3-intake-step-copy")).toHaveTextContent(
      "Step 2 of 2",
    );

    fillContactAndSubmit(dialog);

    await waitFor(() => expect(onSubmitLead).toHaveBeenCalledWith({
      intent: "has_quote",
      zip: "34997",
      projectType: "",
      openings: "",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    }, expect.objectContaining({
      captureAttemptId: expect.any(String),
      landingVisitId: expect.any(String),
      entryPoint: "hero_primary",
    })));
  });

  it("deduplicates rapid written-estimate activations until the intake closes", async () => {
    renderPage();
    const opener = screen.getByTestId("nq3-escape-hatch");

    fireEvent.click(opener);
    fireEvent.click(opener);

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(opener);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("keeps the uploader hidden through failure and success, then reveals exact persisted IDs on close", async () => {
    const onSubmitLead = vi.fn()
      .mockResolvedValueOnce({ ok: false, message: "Try again." })
      .mockResolvedValueOnce({
        ok: true,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        reused: false,
      });
    renderPage(onSubmitLead);
    const opener = screen.getByTestId("nq3-escape-hatch");
    opener.focus();
    const focusSpy = vi.spyOn(opener, "focus");
    const dialog = advanceHasQuoteToContactStep();
    const uploadSection = document.querySelector<HTMLElement>(
      "section[data-campaign-shared-ui]",
    );

    expect(uploadSection).toHaveAttribute("hidden");
    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    fillContactAndSubmit(dialog);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Try again.");
    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    expect(uploadSection).toHaveAttribute("hidden");
    expect(window.sessionStorage.getItem(NQ3_UPLOAD_RESUME_KEY)).toBeNull();
    expect(setFunnelLeadIdMock).not.toHaveBeenCalled();
    expect(setFunnelSessionIdMock).not.toHaveBeenCalled();
    expect(setFunnelScanSessionIdMock).not.toHaveBeenCalled();
    expect(setFunnelQuoteFileIdMock).not.toHaveBeenCalled();
    expect(setFunnelPhoneMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByTestId("nq3-intake-submit"));
    expect(
      await within(dialog).findByRole("heading", { name: "Ready to upload." }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Your details are saved. Upload your written estimate to start the check.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    expect(uploadSection).toHaveAttribute("hidden");
    expect(
      JSON.parse(window.sessionStorage.getItem(NQ3_UPLOAD_RESUME_KEY) ?? "null"),
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
    expect(setFunnelPhoneMock).toHaveBeenCalledOnce();
    expect(setFunnelPhoneMock).toHaveBeenCalledWith(
      "+13055550142",
      "screened_valid",
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Upload My Estimate" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
        "data-visible",
        "yes",
      ),
    );
    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-lead-id",
      LEAD_ID,
    );
    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-session-id",
      SESSION_ID,
    );
    expect(uploadSection).not.toHaveAttribute("hidden");
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    await waitFor(() => expect(opener).toHaveFocus());
    const visibleCallIndex = uploadZonePropsMock.mock.calls.findIndex(
      ([props]) => (props as { isVisible?: boolean }).isVisible === true,
    );
    expect(visibleCallIndex).toBeGreaterThanOrEqual(0);
    const focusInvocationOrder = focusSpy.mock.invocationCallOrder[
      focusSpy.mock.invocationCallOrder.length - 1
    ];
    const revealInvocationOrder =
      uploadZonePropsMock.mock.invocationCallOrder[visibleCallIndex];
    expect(typeof focusInvocationOrder).toBe("number");
    expect(typeof revealInvocationOrder).toBe("number");
    expect(focusInvocationOrder as number).toBeLessThan(
      revealInvocationOrder as number,
    );
  });

  it("keeps the upload section hidden when the has-quote intake is cancelled", async () => {
    const { unmount } = renderPage();
    const opener = screen.getByTestId("nq3-escape-hatch");
    opener.focus();
    fireEvent.click(opener);
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(917);
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("section[data-campaign-shared-ui]"))
      .toHaveAttribute("hidden");
    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    unmount();
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(917);

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("restores only a valid, unexpired NQ3 upload handoff on remount", () => {
    window.sessionStorage.setItem(
      NQ3_UPLOAD_RESUME_KEY,
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: Date.now() + 60_000,
      }),
    );
    const firstRender = renderPage();

    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-visible",
      "yes",
    );
    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-lead-id",
      LEAD_ID,
    );
    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-session-id",
      SESSION_ID,
    );
    firstRender.unmount();

    window.sessionStorage.setItem(
      NQ3_UPLOAD_RESUME_KEY,
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: Date.now() - 1,
      }),
    );
    renderPage();

    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    expect(window.sessionStorage.getItem(NQ3_UPLOAD_RESUME_KEY)).toBeNull();
  });

  it("clears the resume hint and navigates to the classic report on scan start", () => {
    window.sessionStorage.setItem(
      NQ3_UPLOAD_RESUME_KEY,
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: Date.now() + 60_000,
      }),
    );
    renderPage();
    const uploadProps = uploadZonePropsMock.mock.calls[
      uploadZonePropsMock.mock.calls.length - 1
    ]?.[0] as {
      onScanStart?: (fileName: string, scanSessionId: string) => void;
    };

    uploadProps.onScanStart?.(
      "private-estimate.pdf",
      "33333333-3333-4333-8333-333333333333",
    );

    expect(window.sessionStorage.getItem(NQ3_UPLOAD_RESUME_KEY)).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith(
      "/report/classic/33333333-3333-4333-8333-333333333333",
      { state: { freshScan: true } },
    );
  });

  it("does not add contact PII to dataLayer during the handoff", async () => {
    const dataLayer = [{ event: "existing-marker" }];
    Object.assign(window, { dataLayer });
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      reused: false,
    });
    renderPage(onSubmitLead);
    const dialog = advanceHasQuoteToContactStep();

    fillContactAndSubmit(dialog);
    expect(
      await within(dialog).findByRole("heading", { name: "Ready to upload." }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Upload My Estimate" }),
    );

    expect(dataLayer).toEqual([{ event: "existing-marker" }]);
    expect(JSON.stringify(dataLayer)).not.toMatch(
      /Sam|sam@example\.com|3055550142|\+13055550142/,
    );
  });

  it("passes the NQ3 explainer headline without altering the shared default copy", () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        name: "See what WindowMan will check when your first estimate arrives.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /WindowMan turns a contractor estimate into a structured review/,
      ),
    ).toBeInTheDocument();
  });

  it.each(["32901", "33301", "34997"])(
    "accepts Florida ZIP %s and opens directly on project details",
    (zip) => {
    renderPage();
    const heroZip = screen.getAllByLabelText("Florida ZIP code")[0];
    fireEvent.change(heroZip, { target: { value: zip } });
    fireEvent.submit(heroZip.closest("form")!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What are you replacing?" })).toBeInTheDocument();
    },
  );

  it("shows an accessible error for a non-Florida ZIP", () => {
    renderPage();
    const heroZip = screen.getAllByLabelText("Florida ZIP code")[0];
    fireEvent.change(heroZip, { target: { value: "90210" } });
    fireEvent.submit(heroZip.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid 5-digit Florida project ZIP code.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("passes a validated, normalized payload to the submission boundary", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-injected",
      sessionId: "session-injected",
      reused: false,
    });
    renderPage(onSubmitLead);
    advanceToContactStep();

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "Sam@Example.com" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "3055550142" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    await waitFor(() => expect(onSubmitLead).toHaveBeenCalledWith({
      zip: "34997",
      projectType: "Impact windows",
      openings: "6–10",
      timing: "Not sure",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    }, expect.objectContaining({
      captureAttemptId: expect.any(String),
      landingVisitId: expect.any(String),
      entryPoint: "navigation_primary",
    })));
    expect(await screen.findByRole("heading", { name: "You're in." })).toBeInTheDocument();
    expect(screen.getByTestId("nq3-upload-zone")).toHaveAttribute(
      "data-visible",
      "no",
    );
    expect(window.sessionStorage.getItem(NQ3_UPLOAD_RESUME_KEY)).toBeNull();
  });

  it("uses the operational persistence adapter by default", async () => {
    renderPage();
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sam@example.com" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "3055550142" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    await waitFor(() => expect(defaultSubmitMock).toHaveBeenCalledWith({
      zip: "34997",
      projectType: "Impact windows",
      openings: "6–10",
      timing: "Not sure",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    }, expect.objectContaining({
      captureAttemptId: expect.any(String),
      landingVisitId: expect.any(String),
      entryPoint: "navigation_primary",
    })));
    expect(await screen.findByRole("heading", { name: "You're in." })).toBeInTheDocument();
  });

  it("requires a valid email before submission", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-valid",
      sessionId: "session-valid",
      reused: false,
    });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "invalid" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "3055550142" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    expect(await screen.findByText("Enter a valid email address.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(onSubmitLead).not.toHaveBeenCalled();
  });

  it("closes with Escape and returns focus to the opener", async () => {
    renderPage();
    const opener = screen.getByRole("button", { name: "Start My Check" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Florida project ZIP code")).toHaveFocus(),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("traps forward and reverse Tab focus within the dialog", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start My Check" }));
    const dialog = screen.getByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: "Close" });
    const continueButton = within(dialog).getByRole("button", { name: "Continue" });

    await waitFor(() =>
      expect(within(dialog).getByLabelText("Florida project ZIP code")).toHaveFocus(),
    );
    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(continueButton).toHaveFocus();
    fireEvent.keyDown(continueButton, { key: "Tab" });
    expect(closeButton).toHaveFocus();
  });

  it("rejects repeated and canonical fake phone numbers before submission", () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-phone",
      sessionId: "session-phone",
      reused: false,
    });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sam@example.com" } });
    const phoneInput = screen.getByLabelText("Mobile number");

    fireEvent.change(phoneInput, { target: { value: "1111111111" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));
    expect(
      screen.getByText("Enter a valid 10-digit mobile number."),
    ).toBeInTheDocument();

    fireEvent.change(phoneInput, { target: { value: "1234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));
    expect(
      screen.getByText("Enter a valid 10-digit mobile number."),
    ).toBeInTheDocument();
    expect(onSubmitLead).not.toHaveBeenCalled();
  });

  it("opens Get Started at the location step", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start My Check" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Where's the project?" }),
    ).toBeInTheDocument();
  });

  it("advances each single-choice step on one activation, with no Continue button", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start My Check" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Enter a valid 5-digit Florida project ZIP code.",
    );

    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(
      within(dialog).getByRole("heading", { name: "What are you replacing?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Impact doors" }));
    expect(
      within(dialog).getByRole("heading", { name: "Roughly how many openings?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: "1–5" }));
    expect(
      within(dialog).getByRole("heading", { name: "When are you hoping to start?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Planning ahead" }));
    expect(
      within(dialog).getByRole("heading", { name: "Where should we send it?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Get My Comparison" }),
    ).toBeInTheDocument();
  });

  it("renders visible Step X of 5 copy and an accessible step name on every step", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start My Check" }));
    const dialog = screen.getByRole("dialog");
    const stepCopy = () =>
      within(dialog).getByTestId("nq3-intake-step-copy").textContent;
    const progressLabel = () =>
      within(dialog)
        .getByTestId("nq3-intake-progress")
        .getAttribute("aria-valuetext");

    expect(stepCopy()).toBe("Step 1 of 5");
    expect(progressLabel()).toBe("Step 1 of 5: Project location");
    expect(within(dialog).getByText("Step 1")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(stepCopy()).toBe("Step 2 of 5");
    expect(progressLabel()).toBe("Step 2 of 5: Product");

    fireEvent.click(within(dialog).getByRole("radio", { name: "Impact doors" }));
    expect(stepCopy()).toBe("Step 3 of 5");
    expect(progressLabel()).toBe("Step 3 of 5: Openings");

    fireEvent.click(within(dialog).getByRole("radio", { name: "1–5" }));
    expect(stepCopy()).toBe("Step 4 of 5");
    expect(progressLabel()).toBe("Step 4 of 5: Timing");

    fireEvent.click(within(dialog).getByRole("radio", { name: "Planning ahead" }));
    expect(stepCopy()).toBe("Step 5 of 5");
    expect(progressLabel()).toBe("Step 5 of 5: Contact details");
    expect(within(dialog).getByText("Step 5")).toBeInTheDocument();
  });

  it("renders the five openings choices as one vertical radiogroup", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start My Check" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    fireEvent.click(within(dialog).getByRole("radio", { name: "Impact windows" }));

    const group = within(dialog).getByRole("radiogroup", {
      name: "Approximate openings",
    });
    const options = within(group).getAllByRole("radio");

    expect(options).toHaveLength(5);
    expect(options.map((option) => option.textContent)).toEqual([
      "1–5",
      "6–10",
      "11–15",
      "16+",
      "Not sure",
    ]);
    expect(group).toHaveClass("opts");
    expect(within(group).queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("moves focus to the new step heading after automatic advancement", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start My Check" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(
        within(dialog).getByRole("heading", { name: "What are you replacing?" }),
      ).toHaveFocus(),
    );

    fireEvent.click(within(dialog).getByRole("radio", { name: "Impact doors" }));

    await waitFor(() =>
      expect(
        within(dialog).getByRole("heading", { name: "Roughly how many openings?" }),
      ).toHaveFocus(),
    );
  });

  it("does not advance when an option only receives focus", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start My Check" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    const option = within(dialog).getByRole("radio", { name: "Impact doors" });
    fireEvent.focus(option);
    fireEvent.mouseOver(option);
    fireEvent.mouseDown(option);
    fireEvent.keyDown(option, { key: "ArrowDown" });

    expect(
      within(dialog).getByRole("heading", { name: "What are you replacing?" }),
    ).toBeInTheDocument();
    expect(option).toHaveAttribute("aria-checked", "false");
  });

  it("advances on keyboard activation of a choice card", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Start My Check" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Florida project ZIP code"), {
      target: { value: "34997" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    const option = within(dialog).getByRole("radio", { name: "Impact doors" });
    option.focus();
    fireEvent.keyDown(option, { key: "Enter" });
    fireEvent.keyUp(option, { key: "Enter" });
    fireEvent.click(option);

    expect(
      within(dialog).getByRole("heading", { name: "Roughly how many openings?" }),
    ).toBeInTheDocument();
  });

  it("preserves selections when navigating Back across all choice steps", () => {
    renderPage();
    const dialog = advanceToContactStep();

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(
      within(dialog).getByRole("radio", { name: "Not sure" }),
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(within(dialog).getByRole("radio", { name: "6–10" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(
      within(dialog).getByRole("radio", { name: "Impact windows" }),
    ).toHaveAttribute("aria-checked", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(
      within(dialog).getByLabelText("Florida project ZIP code"),
    ).toHaveValue("34997");
  });

  it("requires a valid first name before persistence", async () => {
    const onSubmitLead = vi.fn();
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "3055550142" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    expect(await screen.findByText("Enter your first name.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(onSubmitLead).not.toHaveBeenCalled();
  });

  it("does not show success before confirmed server success", async () => {
    let resolveSubmit!: (value: {
      ok: true;
      leadId: string;
      sessionId: string;
      reused: boolean;
    }) => void;
    const onSubmitLead = vi.fn(
      () =>
        new Promise<{
          ok: true;
          leadId: string;
          sessionId: string;
          reused: boolean;
        }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "3055550142" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    await waitFor(() => expect(onSubmitLead).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "You're in." }))
      .not.toBeInTheDocument();

    resolveSubmit({
      ok: true,
      leadId: "lead-new",
      sessionId: "session-new",
      reused: false,
    });
    expect(await screen.findByRole("heading", { name: "You're in." }))
      .toBeInTheDocument();
  });

  it("does not show success after failed persistence", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: false,
      message: "Try again.",
    });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "3055550142" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Try again.");
    expect(screen.queryByRole("heading", { name: "You're in." }))
      .not.toBeInTheDocument();
  });

  it("shows success for a reused persisted lead through the same boundary", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({
      ok: true,
      leadId: "lead-reused",
      sessionId: "session-reused",
      reused: true,
    });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "sam@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "3055550142" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    expect(await screen.findByRole("heading", { name: "You're in." }))
      .toBeInTheDocument();
  });
});
