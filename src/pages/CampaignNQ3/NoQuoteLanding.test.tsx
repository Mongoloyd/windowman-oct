import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import NoQuoteLanding from "./NoQuoteLanding";
import { scopeNq3Css } from "./scopeNq3Css";

const { defaultSubmitMock } = vi.hoisted(() => ({
  defaultSubmitMock: vi.fn(),
}));

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
}));

vi.mock("@/pages/Index", () => ({
  default: () => <div>Home</div>,
}));

function renderPage(onSubmitLead?: Parameters<typeof NoQuoteLanding>[0]["onSubmitLead"]) {
  return render(
    <HelmetProvider>
      <NoQuoteLanding onSubmitLead={onSubmitLead} />
    </HelmetProvider>,
  );
}

function advanceToContactStep() {
  fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Florida ZIP code"), { target: { value: "34997" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "Windows" }));
  fireEvent.click(within(dialog).getByRole("radio", { name: "6–10" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
}

describe("CampaignNQ3 NoQuoteLanding", () => {
  beforeEach(() => {
    defaultSubmitMock.mockReset();
    defaultSubmitMock.mockResolvedValue({ ok: true });
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

  it("keeps the prototype stylesheet byte-for-byte intact", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/CampaignNQ3/nq-landing.css"));
    expect(css.byteLength).toBe(14_808);
    expect(createHash("sha256").update(css).digest("hex")).toBe(
      "4d12e570456411fda6011e84782bb0903afb704d67aeed746ba90158d914008d",
    );
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
      .toBe('[data-page="campaign-nq3"] section{padding:1px}@media(max-width:1px){[data-page="campaign-nq3"] nav{top:0}}');
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    expect(document.querySelector("style[data-nq3-landing-styles]")).not.toBeInTheDocument();
  });

  it("accepts a 34xxx Florida ZIP and opens directly on project details", () => {
    renderPage();
    const heroZip = screen.getAllByLabelText("Florida ZIP code")[0];
    fireEvent.change(heroZip, { target: { value: "34997" } });
    fireEvent.submit(heroZip.closest("form")!);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What are you replacing?" })).toBeInTheDocument();
  });

  it("shows an accessible error for a non-Florida ZIP", () => {
    renderPage();
    const heroZip = screen.getAllByLabelText("Florida ZIP code")[0];
    fireEvent.change(heroZip, { target: { value: "90210" } });
    fireEvent.submit(heroZip.closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid 5-digit Florida ZIP code.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("passes a validated, normalized payload to the submission boundary", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({ ok: true });
    renderPage(onSubmitLead);
    advanceToContactStep();

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "Sam@Example.com" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "3055550142" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    await waitFor(() => expect(onSubmitLead).toHaveBeenCalledWith({
      zip: "34997",
      projectType: "Windows",
      openings: "6–10",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    }));
    expect(await screen.findByRole("heading", { name: "You're in." })).toBeInTheDocument();
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
      projectType: "Windows",
      openings: "6–10",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    }));
    expect(await screen.findByRole("heading", { name: "You're in." })).toBeInTheDocument();
  });

  it("requires a valid email before submission", async () => {
    const onSubmitLead = vi.fn().mockResolvedValue({ ok: true });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "invalid" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "3055550142" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(onSubmitLead).not.toHaveBeenCalled();
  });

  it("closes with Escape and returns focus to the opener", async () => {
    renderPage();
    const opener = screen.getByRole("button", { name: "Get Started" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialog).getByLabelText("Florida ZIP code")).toHaveFocus());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("traps forward and reverse Tab focus within the dialog", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const dialog = screen.getByRole("dialog");
    const zipInput = within(dialog).getByLabelText("Florida ZIP code");
    const continueButton = within(dialog).getByRole("button", { name: "Continue" });

    await waitFor(() => expect(zipInput).toHaveFocus());
    fireEvent.keyDown(zipInput, { key: "Tab", shiftKey: true });
    expect(continueButton).toHaveFocus();
    fireEvent.keyDown(continueButton, { key: "Tab" });
    expect(zipInput).toHaveFocus();
  });

  it("rejects repeated and canonical fake phone numbers before submission", () => {
    const onSubmitLead = vi.fn().mockResolvedValue({ ok: true });
    renderPage(onSubmitLead);
    advanceToContactStep();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sam@example.com" } });
    const phoneInput = screen.getByLabelText("Mobile number");

    fireEvent.change(phoneInput, { target: { value: "1111111111" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid 10-digit mobile number.");

    fireEvent.change(phoneInput, { target: { value: "1234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Get My Comparison" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid 10-digit mobile number.");
    expect(onSubmitLead).not.toHaveBeenCalled();
  });
});
