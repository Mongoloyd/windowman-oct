/**
 * Sprint 2 contract for the `/scan` local conversion prototype.
 *
 * Proves hero messaging, above-fold upload focus, local validation, analysis
 * theater, lead modal, example Truth Report, reverse-auction copy, and that no
 * FileReader / fetch / Supabase / tracking path is used.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import ScanLandingExperience from "./ScanLandingExperience";
import { ANALYSIS_DURATION_MS, MAX_PROTOTYPE_BYTES } from "./scanPrototypeModel";

const supabaseInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: supabaseInvoke },
    rpc: vi.fn(),
    from: vi.fn(),
    storage: { from: vi.fn() },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

const fetchSpy = vi.fn();
const scrollIntoViewSpy = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
  Element.prototype.scrollIntoView = scrollIntoViewSpy;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function getUploadInput() {
  return screen.getByLabelText(/drop your estimate here/i) as HTMLInputElement;
}

function selectFile(file: File, input = getUploadInput()) {
  fireEvent.change(input, { target: { files: [file] } });
}

function makePdf(name = "estimate.pdf", size = 2048) {
  const contents = "x".repeat(size);
  return new File([contents], name, { type: "application/pdf" });
}

async function advanceThroughAnalysis() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ANALYSIS_DURATION_MS + 50);
  });
}

async function completeLeadForm(
  dialog: HTMLElement,
  values: { name?: string; email?: string; phone?: string } = {},
) {
  const {
    name = "Alex Homeowner",
    email = "alex@example.com",
    phone = "(305) 555-1212",
  } = values;

  fireEvent.change(within(dialog).getByLabelText(/full name/i), {
    target: { value: name },
  });
  fireEvent.change(within(dialog).getByLabelText(/^email/i), {
    target: { value: email },
  });
  fireEvent.change(within(dialog).getByLabelText(/^phone/i), {
    target: { value: phone },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: /open my example truth report/i }),
  );
}

describe("ScanLandingExperience", () => {
  it("renders the new hero message, competition stage, reverse-auction, and authority ribbon", () => {
    render(<ScanLandingExperience />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /you got the quote\.\s*now make it compete\./i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /make my quote compete/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/free homeowner quote review/i)).toBeInTheDocument();
    expect(getUploadInput()).toBeInTheDocument();
    expect(screen.getByText(/private estimate review/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /drop your estimate here/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/example truth report/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: /the estimate you already have is your negotiating weapon/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /free to homeowners/i }),
    ).toBeInTheDocument();
  });

  it("scrolls to the upload stage and focuses the upload control from the hero CTA", () => {
    render(<ScanLandingExperience />);

    fireEvent.click(screen.getByRole("button", { name: /make my quote compete/i }));

    expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewSpy.mock.instances[0]).toBe(document.getElementById("scan-upload"));
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(document.activeElement).toBe(getUploadInput());
  });

  it("skips smooth scrolling when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));

    render(<ScanLandingExperience />);
    fireEvent.click(screen.getByRole("button", { name: /make my quote compete/i }));

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("accepts valid supported files and shows the review CTA", () => {
    const fileReaderSpy = vi.spyOn(globalThis, "FileReader");
    render(<ScanLandingExperience />);

    const file = makePdf("a-very-long-contractor-estimate-filename-2026.pdf");
    selectFile(file);

    expect(
      screen.getByText("a-very-long-contractor-estimate-filename-2026.pdf"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /review this estimate free/i }),
    ).toBeInTheDocument();
    expect(getUploadInput().value).toBe("");
    expect(fileReaderSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabaseInvoke).not.toHaveBeenCalled();
  });

  it("rejects zero-byte, oversized, and unsupported files", () => {
    render(<ScanLandingExperience />);
    const input = getUploadInput();

    selectFile(new File([], "empty.pdf", { type: "application/pdf" }), input);
    expect(screen.getByRole("alert")).toHaveTextContent(/empty/i);
    expect(
      screen.queryByRole("button", { name: /review this estimate free/i }),
    ).not.toBeInTheDocument();

    const oversized = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: MAX_PROTOTYPE_BYTES + 1 });
    selectFile(oversized, input);
    expect(screen.getByRole("alert")).toHaveTextContent(/15 mib/i);

    selectFile(new File(["x"], "notes.txt", { type: "text/plain" }), input);
    expect(screen.getByRole("alert")).toHaveTextContent(/unsupported file type/i);
  });

  it("selects the first dropped file when several are dropped", () => {
    render(<ScanLandingExperience />);

    const first = makePdf("first.pdf");
    const second = makePdf("second.pdf");
    const fileList = {
      0: first,
      1: second,
      length: 2,
      item: (index: number) => (index === 0 ? first : second),
    } as unknown as FileList;

    fireEvent.drop(screen.getByTestId("scan-upload-dropzone"), {
      dataTransfer: { files: fileList },
    });

    expect(screen.getByText("first.pdf")).toBeInTheDocument();
    expect(
      screen.getByText(/windowman reviews one estimate at a time/i),
    ).toBeInTheDocument();
  });

  it("allows the same file to be selected again after clearing the input", () => {
    render(<ScanLandingExperience />);
    const input = getUploadInput();
    const file = makePdf("same.pdf");

    selectFile(file, input);
    expect(screen.getByText("same.pdf")).toBeInTheDocument();
    expect(input.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: /remove file/i }));
    expect(screen.queryByText("same.pdf")).not.toBeInTheDocument();

    selectFile(file, input);
    expect(screen.getByText("same.pdf")).toBeInTheDocument();
  });

  it("prevents duplicate analysis submission and opens the lead modal after timers", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ScanLandingExperience />);
    selectFile(makePdf());

    const reviewButton = screen.getByRole("button", { name: /review this estimate free/i });
    fireEvent.click(reviewButton);
    fireEvent.click(reviewButton);

    expect(screen.getByText(/building your leverage map/i)).toBeInTheDocument();
    expect(
      screen.getByText(/local prototype: no document has been uploaded/i),
    ).toBeInTheDocument();

    await advanceThroughAnalysis();

    expect(
      await screen.findByRole("heading", { name: /your review is ready/i }),
    ).toBeInTheDocument();
  });

  it("blocks an invalid lead form and focuses the first invalid field", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ScanLandingExperience />);
    selectFile(makePdf());
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceThroughAnalysis();

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /open my example truth report/i }),
    );

    const alerts = within(dialog).getAllByRole("alert");
    expect(alerts[0]).toHaveTextContent(/full name/i);
    expect(document.activeElement).toBe(within(dialog).getByLabelText(/full name/i));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabaseInvoke).not.toHaveBeenCalled();
  });

  it("opens the example Truth Report from a valid lead form", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ScanLandingExperience />);
    selectFile(makePdf());
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceThroughAnalysis();

    const dialog = await screen.findByRole("dialog");
    await completeLeadForm(dialog);

    const report = await screen.findByRole("dialog");
    expect(within(report).getByText(/^example truth report$/i)).toBeInTheDocument();
    expect(
      within(report).getByRole("heading", {
        name: /here.?s where the quote needs pressure/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows only the local prototype statement for the contractor CTA", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ScanLandingExperience />);
    selectFile(makePdf());
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceThroughAnalysis();

    const lead = await screen.findByRole("dialog");
    await completeLeadForm(lead);

    const report = await screen.findByRole("dialog");
    fireEvent.click(
      within(report).getByRole("button", { name: /make contractors compete/i }),
    );

    expect(
      within(report).getByText(
        /the live contractor-network handoff will be connected in a later sprint/i,
      ),
    ).toBeInTheDocument();
    expect(within(report).queryByText(/match found/i)).not.toBeInTheDocument();
    expect(within(report).queryByText(/contractor contacted/i)).not.toBeInTheDocument();
  });

  it("resets to idle from RUN ANOTHER ESTIMATE", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ScanLandingExperience />);
    selectFile(makePdf("reset-me.pdf"));
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceThroughAnalysis();

    const lead = await screen.findByRole("dialog");
    await completeLeadForm(lead);

    const report = await screen.findByRole("dialog");
    fireEvent.click(within(report).getByRole("button", { name: /run another estimate/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("reset-me.pdf")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /review this estimate free/i }),
    ).not.toBeInTheDocument();
  });

  it("issues no fetch, FileReader, Supabase, or tracking calls across the local funnel", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fileReaderSpy = vi.spyOn(globalThis, "FileReader");
    render(<ScanLandingExperience />);

    fireEvent.click(screen.getByRole("button", { name: /make my quote compete/i }));
    selectFile(makePdf());
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceThroughAnalysis();

    const lead = await screen.findByRole("dialog");
    await completeLeadForm(lead);

    expect(fileReaderSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabaseInvoke).not.toHaveBeenCalled();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe("/scan route mount flag", () => {
  async function renderAppAtScan(flagValue: string) {
    cleanup();
    vi.resetModules();
    vi.stubEnv("VITE_SCAN_ROUTE_MOUNTED", flagValue);
    window.history.pushState({}, "", "/scan");
    const { default: App } = await import("@/App");
    return render(<App />);
  }

  it("mounts /scan when the flag is exactly \"true\"", async () => {
    await renderAppAtScan("true");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /you got the quote\.\s*now make it compete\./i,
        }),
      ).toBeInTheDocument();
    });
  });

  it.each(["", "TRUE", "1", "yes"])(
    "leaves /scan unmounted for the malformed flag value %j",
    async (flagValue) => {
      await renderAppAtScan(flagValue);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1, name: "404" })).toBeInTheDocument();
      });
      expect(
        screen.queryByRole("heading", {
          name: /you got the quote\.\s*now make it compete\./i,
        }),
      ).not.toBeInTheDocument();
    },
  );
});
