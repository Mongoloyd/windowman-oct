import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeOpenRequest, IntakeSubmitter } from "@/components/intake/universal/intakeTypes";
import ProphecyLanding from "./CampaignProphecy/ProphecyLanding";
import NoQuoteLanding from "./CampaignNQ3/NoQuoteLanding";
import CampaignNq4Page from "./CampaignNQ4/CampaignNq4Page";
import { SAMPLE_QUOTE } from "@/components/synthetic-demo/fixture";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), capture: vi.fn(), handoffCapture: vi.fn(), intake: vi.fn(), intakeSubmitter: vi.fn(), submit: vi.fn() }));
vi.mock("react-router-dom", async () => ({ ...await vi.importActual<typeof import("react-router-dom")>("react-router-dom"), useNavigate: () => mocks.navigate }));
vi.mock("@/components/synthetic-demo/productionCaptureClient", () => ({ productionCaptureClient: { startSession: () => ({
  sessionId: "22222222-2222-4222-8222-222222222222", create: mocks.capture,
  updateZip: vi.fn(), updatePhone: vi.fn(), updateIntake: vi.fn(),
}) } }));
vi.mock("@/lib/captureQuoteEducationDemoLead", () => ({ captureQuoteEducationDemoLead: mocks.handoffCapture }));
vi.mock("@/components/intake/universal/UniversalIntakeHost", () => ({ default: ({ openRequest, submitter }: { openRequest: IntakeOpenRequest | null; submitter: IntakeSubmitter }) => {
  if (!openRequest) return null;
  mocks.intake(openRequest);
  mocks.intakeSubmitter(submitter);
  return <section role="dialog" aria-label="Canonical intake">Existing {openRequest.presetValues?.intent} intake</section>;
} }));
vi.mock("@/components/UploadZone", () => ({ default: () => null }));
vi.mock("@/state/scanFunnel", () => ({ useScanFunnelSafe: () => null }));
vi.mock("./CampaignNQ/useCampaignNqIllumination", () => ({ useCampaignNqIllumination: () => ({ current: null }) }));
vi.mock("@/lib/tracking/prophecyEvents", () => ({ pushProphecyLowIntentEvent: vi.fn() }));
vi.mock("./CampaignProphecy/campaignProphecyLeadCapture", () => ({ createCampaignProphecyLeadSubmitter: () => mocks.submit }));
vi.mock("./CampaignNQ3/campaignNq3LeadCapture", () => ({ createCampaignNq3LeadSubmitter: () => mocks.submit }));
vi.mock("./CampaignNQ4/campaignNq4LeadCapture", () => ({ createCampaignNq4LeadSubmitter: () => mocks.submit }));
const cases = [
  { path: "/prophecy", variant: "xray", entryPoint: "prophecy_hero_sample_audit", cta: "See a sample audit first", Page: ProphecyLanding },
  { path: "/nq3", variant: "lens", entryPoint: "nq3_hero_quote_lens", cta: "Try the 25-second Quote Lens", Page: NoQuoteLanding },
  { path: "/nq4", variant: "challenge", entryPoint: "nq4_hero_quote_challenge", cta: "Take the 3-question Quote Challenge", Page: CampaignNq4Page },
] as const;
beforeEach(() => { vi.clearAllMocks(); window.sessionStorage.clear(); window.localStorage.clear(); mocks.capture.mockResolvedValue({ ok: true,
  leadId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222", source: "quote-education-demo" });
  mocks.handoffCapture.mockResolvedValue({ ok: true, leadId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222", source: "quote-education-demo" }); });
afterEach(cleanup);
describe("synthetic demo host contracts", () => {
  it.each(cases)("$path opens and closes without navigation, writes or changing native entry surfaces", async ({ path, variant, cta, Page }) => {
    window.history.replaceState({}, "", `${path}?utm_source=qa&gclid=test-click`);
    render(<HelmetProvider><MemoryRouter><Page /></MemoryRouter></HelmetProvider>);
    const opener = screen.getByRole("button", { name: cta });
    if (path === "/prophecy") {
      expect(opener.closest('[role="group"]')).toBeNull();
      expect(screen.getByRole("group", { name: "Start here — pick the one that's true" }).querySelectorAll("button")).toHaveLength(2);
    } else {
      const zip = document.getElementById(`${path.slice(1)}-hero-zip`)!;
      fireEvent.change(zip, { target: { value: "33301" } });
      expect(screen.getByTestId(`${path.slice(1)}-escape-hatch`)).toBeInTheDocument();
    }
    opener.focus(); fireEvent.click(opener);
    expect(await screen.findByRole("dialog")).toHaveAttribute("data-synthetic-demo", variant);
    fireEvent.click(screen.getByRole("button", { name: "Close sample demo" }));
    await waitFor(() => expect(opener).toHaveFocus());
    expect(window.location.pathname + window.location.search).toBe(`${path}?utm_source=qa&gclid=test-click`);
    if (path !== "/prophecy") expect(document.getElementById(`${path.slice(1)}-hero-zip`)).toHaveValue("33301");
    expect(mocks.capture).not.toHaveBeenCalled(); expect(mocks.submit).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
  });
  for (const intent of ["has_quote", "no_quote"] as const) {
    it.each(cases)(`$path delegates ${intent} to its existing local intake opener`, async ({ path, variant, cta, entryPoint, Page }) => {
      window.history.replaceState({}, "", path); render(<HelmetProvider><MemoryRouter><Page /></MemoryRouter></HelmetProvider>);
      fireEvent.click(screen.getByRole("button", { name: cta }));
      if (variant === "xray") {
        fireEvent.click(await screen.findByRole("button", { name: intent === "has_quote" ? "I have a quote to upload" : "Help Me Get a Quote" }));
        expect(mocks.capture).not.toHaveBeenCalled();
      } else {
        await screen.findByText(/(?:Sample risk sweep|Contract challenge) · 1 of 3/);
        for (let step = 0; step < 3; step++) {
          if (variant === "challenge") fireEvent.click(screen.getByRole("radio", { name: new RegExp(SAMPLE_QUOTE.signals[step].answers[0].label) }));
          else fireEvent.click(screen.getByRole("button", { name: `Inspect ${SAMPLE_QUOTE.signals[step].label.toLowerCase()}` }));
          fireEvent.click(screen.getByRole("button", { name: step === 2 ? (variant === "challenge" ? "Build my 3-question checklist" : "Reveal my question list")
            : variant === "lens" ? "Next signal" : "Try the next question" }));
        }
        fireEvent.click(screen.getByRole("button", { name: "Save my next step" }));
        fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Taylor" } });
        fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "taylor@example.test" } });
        fireEvent.click(screen.getByRole("button", { name: "Save my details" })); await screen.findByText("Your details are saved.");
        expect(mocks.capture).toHaveBeenCalledWith(expect.objectContaining({ variant, attribution: { sourcePath: path, entryPoint }, fixtureId: SAMPLE_QUOTE.id }));
        fireEvent.click(screen.getByRole("button", { name: intent === "has_quote" ? "Check my written estimate" : "Help me request an estimate" }));
      }
      await screen.findByRole("dialog", { name: "Canonical intake" });
      expect(document.querySelector("[data-synthetic-demo]")).toBeNull();
      expect(mocks.intake).toHaveBeenCalledWith(expect.objectContaining({ entryPoint: "hero_primary", startingStep: "location", presetValues: expect.objectContaining({ intent }) }));
      if (variant !== "xray") {
        expect(mocks.intake).toHaveBeenCalledWith(expect.objectContaining({ presetValues: expect.objectContaining({ name: "Taylor", email: "taylor@example.test" }) }));
        const submitter = mocks.intakeSubmitter.mock.calls.at(-1)?.[0] as IntakeSubmitter;
        await expect(submitter({
          intent,
          zip: "33301",
          projectType: intent === "no_quote" ? "Impact windows" : "",
          openings: intent === "no_quote" ? "6–10" : "",
          timing: intent === "no_quote" ? "1–3 months" : "",
          name: "Taylor",
          email: "taylor@example.test",
          phone: "+13055550100",
        }, { captureAttemptId: "attempt", landingVisitId: "visit", entryPoint: "hero_primary" })).resolves.toMatchObject({
          ok: true,
          leadId: "11111111-1111-4111-8111-111111111111",
          sessionId: "22222222-2222-4222-8222-222222222222",
        });
        expect(mocks.handoffCapture.mock.calls.map(([request]) => request.action)).toEqual([
          "update_zip", "update_phone", "update_intake",
        ]);
      }
      expect(mocks.submit).not.toHaveBeenCalled(); expect(mocks.navigate).not.toHaveBeenCalled();
    });
  }
});
