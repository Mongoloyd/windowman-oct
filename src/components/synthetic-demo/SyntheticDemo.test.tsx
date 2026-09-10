import { useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SyntheticDemo from "./SyntheticDemo";
import SyntheticDemoLauncher from "./SyntheticDemoLauncher";
import { createMemoryCaptureClient } from "./memoryCaptureClient";
import { SAMPLE_QUOTE } from "./fixture";
import { VARIANT_RENDERERS } from "./variantRenderers";
import type { SyntheticDemoCaptureClient, SyntheticDemoVariant } from "./types";

const attribution = { sourcePath: "/prophecy", entryPoint: "prophecy_hero_sample_audit" };
const sessionId = "22222222-2222-4222-8222-222222222222";
const leadId = "11111111-1111-4111-8111-111111111111";
const success = { ok: true, leadId, sessionId, source: "quote-education-demo" };
function captureClient(create = vi.fn<(input: unknown) => Promise<unknown>>().mockResolvedValue(success)) {
  return { create, client: { startSession: vi.fn(() => ({ sessionId, create, updateZip: vi.fn(), updatePhone: vi.fn(), updateIntake: vi.fn() })) } satisfies SyntheticDemoCaptureClient };
}
function Harness({ variant = "lens", client = createMemoryCaptureClient(), has = vi.fn(), no = vi.fn() }:
  { variant?: SyntheticDemoVariant; client?: SyntheticDemoCaptureClient; has?: () => void; no?: () => void }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return <><button ref={openerRef} onClick={() => setOpen(true)}>Launch</button><SyntheticDemo open={open} variant={variant} captureClient={client}
    attribution={attribution} onOpenChange={setOpen} onHasQuote={has} onNoQuote={no} openerRef={openerRef} /></>;
}
async function openDemo() {
  const opener = screen.getByRole("button", { name: "Launch" });
  opener.focus(); fireEvent.click(opener);
  await waitFor(() => expect(document.querySelector(".sd-xray-showcase, .sd-progress")).not.toBeNull());
  return opener;
}
async function complete(variant: "lens" | "challenge") {
  for (let step = 0; step < 3; step++) {
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
    if (variant === "challenge") fireEvent.click(screen.getByRole("radio", { name: new RegExp(SAMPLE_QUOTE.signals[step].answers[0].label) }));
    else if (variant === "lens") fireEvent.click(screen.getByRole("button", { name: `Inspect ${SAMPLE_QUOTE.signals[step].label.toLowerCase()}` }));
    if (variant === "challenge") expect(screen.getByRole("status")).toHaveTextContent(SAMPLE_QUOTE.signals[step].answers[0].coaching);
    fireEvent.click(screen.getByRole("button", { name: step === 2 ? (variant === "challenge" ? "Build my 3-question checklist" : "Reveal my question list")
      : variant === "lens" ? "Next signal" : "Try the next question" }));
    if (step < 2) expect(document.activeElement).toHaveAttribute("data-step-focus");
  }
  expect(screen.getByRole("heading", { name: "Three better questions. One stronger estimate." })).toBeInTheDocument();
  expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
}
function fillCapture() {
  fireEvent.click(screen.getByRole("button", { name: "Save my next step" }));
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Taylor" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "taylor@example.test" } });
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("portable SyntheticDemo", () => {
  it.each(["has_quote", "no_quote"] as const)("delivers static X-Ray %s once, after close, with no capture writes or invented identity", async (target) => {
    const { client, create } = captureClient();
    const has = vi.fn(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const no = vi.fn(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    render(<Harness variant="xray" client={client} has={has} no={no} />);
    const opener = await openDemo();
    expect(VARIANT_RENDERERS.xray).toBeTypeOf("function");
    expect(screen.getByText(SAMPLE_QUOTE.signals[0].finding)).toBeVisible();
    expect(document.querySelector(".sd-progress, input")).toBeNull();
    const button = screen.getByRole("button", { name: target === "has_quote" ? "I have a quote to upload" : "Help Me Get a Quote" });
    fireEvent.click(button); fireEvent.click(button);
    const called = target === "has_quote" ? has : no;
    await waitFor(() => expect(called).toHaveBeenCalledTimes(1));
    expect(called).toHaveBeenCalledWith({ variant: "xray", attribution });
    expect(target === "has_quote" ? no : has).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    expect(create).not.toHaveBeenCalled();
    const session = client.startSession.mock.results[0].value;
    expect(session.updateZip).not.toHaveBeenCalled();
    expect(session.updatePhone).not.toHaveBeenCalled();
    expect(session.updateIntake).not.toHaveBeenCalled();
  });
  it("discards a local X-Ray image error on close and restores the original opener", async () => {
    render(<Harness variant="xray" />); const opener = await openDemo();
    fireEvent.error(document.querySelector(".sd-xray-photograph")!);
    expect(screen.getByRole("alert")).toHaveTextContent("The sample photo could not load");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
    await openDemo();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help Me Get a Quote" })).toBeEnabled();
    expect(document.body).toHaveAttribute("data-scroll-locked");
  });
  it.each(["lens", "challenge"] as const)("maps and completes the real %s interaction before mounting contact fields", async (variant) => {
    expect(VARIANT_RENDERERS[variant]).toBeTypeOf("function");
    render(<Harness variant={variant} />);
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    await openDemo();
    expect(screen.queryByRole("button", { name: "Help Me Get a Quote" })).not.toBeInTheDocument();
    await complete(variant); fillCapture();
    await waitFor(() => expect(screen.getByLabelText("Email address")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Save my details" }));
    expect(await screen.findByText("Your details are saved.")).toBeVisible();
    expect(screen.getByText("Your details are saved.").closest('[role="status"]')).toHaveFocus();
  });
  it("deduplicates rapid submits, retains values on failure, and visibly retries", async () => {
    let finish: (result: unknown) => void = () => undefined;
    const request = vi.fn<(input: unknown) => Promise<unknown>>().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue(success);
    const { client } = captureClient(request);
    render(<Harness client={client} />); await openDemo(); await complete("lens"); fillCapture();
    const form = screen.getByLabelText("Email address").closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: false }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your details are still here");
    expect(screen.getByLabelText("First name")).toHaveValue("Taylor");
    expect(screen.getByLabelText("Email address")).toHaveValue("taylor@example.test");
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByText("Your details are saved.")).toBeVisible());
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("rejects mismatched capture success and does not offer a normal handoff", async () => {
    const { client } = captureClient(vi.fn<(input: unknown) => Promise<unknown>>().mockResolvedValue({ ...success, sessionId: leadId }));
    const no = vi.fn(); render(<Harness client={client} no={no} />); await openDemo(); await complete("lens"); fillCapture();
    fireEvent.click(screen.getByRole("button", { name: "Save my details" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.queryByRole("button", { name: "Help me request an estimate" })).not.toBeInTheDocument();
    expect(no).not.toHaveBeenCalled();
  });
  it.each(["xray", "lens", "challenge"] as const)("allows %s real-quote escape without a write or no-quote callback", async (variant) => {
    const { client, create } = captureClient(); const has = vi.fn(); const no = vi.fn();
    render(<Harness variant={variant} client={client} has={has} no={no} />); await openDemo();
    fireEvent.click(screen.getByRole("button", { name: variant === "xray" ? "I have a quote to upload" : variant === "lens" ? "Check my real quote instead" : "I already have a quote" }));
    await waitFor(() => expect(has).toHaveBeenCalledTimes(1));
    expect(has).toHaveBeenCalledWith({ variant, attribution });
    expect(no).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
  });
  it.each(["has_quote", "no_quote"] as const)("delivers normal %s callback with trusted demo context only", async (handoff) => {
    const { client } = captureClient(); const has = vi.fn(); const no = vi.fn();
    render(<Harness client={client} has={has} no={no} />); await openDemo(); await complete("lens"); fillCapture();
    fireEvent.click(screen.getByRole("button", { name: "Save my details" })); await screen.findByText("Your details are saved.");
    fireEvent.click(screen.getByRole("button", { name: handoff === "has_quote" ? "Check my written estimate" : "Help me request an estimate" }));
    const called = handoff === "has_quote" ? has : no;
    await waitFor(() => expect(called).toHaveBeenCalledWith({ variant: "lens", attribution, contact: { firstName: "Taylor", email: "taylor@example.test" }, demoLeadId: leadId, demoSessionId: sessionId }));
    expect(handoff === "has_quote" ? no : has).not.toHaveBeenCalled();
  });
  it("Escape restores the exact opener and reopen clears stale error, form and modal state", async () => {
    const { client } = captureClient(vi.fn<(input: unknown) => Promise<unknown>>().mockRejectedValue(new Error("private error")));
    render(<Harness client={client} />); const opener = await openDemo(); await complete("lens"); fillCapture();
    fireEvent.click(screen.getByRole("button", { name: "Save my details" })); await screen.findByRole("alert");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    await openDemo(); expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    expect(client.startSession).toHaveBeenCalledTimes(2);
  });
  it("launches lazily and leaves the host path and query untouched", async () => {
    window.history.replaceState({}, "", "/prophecy?utm_source=fixture&gclid=click123");
    const client = createMemoryCaptureClient();
    render(<SyntheticDemoLauncher variant="xray" attribution={attribution} captureClient={client} onHasQuote={vi.fn()} onNoQuote={vi.fn()}
      renderTrigger={(trigger) => <button {...trigger}>Host sample</button>} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const opener = screen.getByRole("button", { name: "Host sample" }); opener.focus(); fireEvent.click(opener);
    await screen.findByRole("dialog"); fireEvent.click(screen.getByRole("button", { name: "Close sample demo" }));
    await waitFor(() => expect(opener).toHaveFocus());
    expect(window.location.pathname + window.location.search).toBe("/prophecy?utm_source=fixture&gclid=click123");
  });
});
