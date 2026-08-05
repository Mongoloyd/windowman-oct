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
import AnalysisSummaryModal from "./AnalysisSummaryModal";
import { demoPreview, MAX_PROTOTYPE_BYTES } from "./scanPrototypeModel";
import type { QuotePreviewViewModel } from "./scanPrototypeModel";

const livePreviewFixture: QuotePreviewViewModel = {
  ...demoPreview,
  source: "live_preview",
  contractorName: "Live Windows Co",
};

const bridgeState = vi.hoisted(() => ({
  phase: "idle" as
    | "idle"
    | "selected"
    | "lead_capture"
    | "summary"
    | "retryable_failure",
  progressLabel: null as string | null,
  error: null as string | null,
  livePreview: null as QuotePreviewViewModel | null,
  scanSessionId: null as string | null,
  busy: false,
  canRetryScan: false,
  canChooseAnother: false,
  holdSelectedFile: vi.fn(),
  releaseSelectedFile: vi.fn(),
  beginScan: vi.fn(async () => {
    if (bridgeState.busy) return;
    bridgeState.busy = true;
    bridgeState.phase = "lead_capture";
    bridgeState.livePreview = livePreviewFixture;
    bridgeState.busy = false;
  }),
  retryScan: vi.fn(),
  resetAll: vi.fn(() => {
    bridgeState.phase = "idle";
    bridgeState.livePreview = null;
    bridgeState.error = null;
    bridgeState.busy = false;
    bridgeState.canRetryScan = false;
    bridgeState.canChooseAnother = false;
  }),
  openSummaryFromLead: vi.fn(() => {
    bridgeState.phase = "summary";
  }),
  closeLeadModal: vi.fn(() => {
    bridgeState.phase = "idle";
  }),
  closeSummaryModal: vi.fn(() => {
    bridgeState.phase = "idle";
  }),
}));

vi.mock("./useRealScanBridge", () => ({
  useRealScanBridge: () => bridgeState,
}));

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
let scanView: ReturnType<typeof render> | null = null;

function renderScan() {
  scanView = render(<ScanLandingExperience />);
  return scanView;
}

function rerenderScan() {
  scanView?.rerender(<ScanLandingExperience />);
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
  Element.prototype.scrollIntoView = scrollIntoViewSpy;
  bridgeState.phase = "idle";
  bridgeState.livePreview = null;
  bridgeState.error = null;
  bridgeState.busy = false;
  bridgeState.canRetryScan = false;
  bridgeState.canChooseAnother = false;
  bridgeState.beginScan.mockClear();
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

async function advanceToLeadModal() {
  fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
  await act(async () => {
    await bridgeState.beginScan.mock.results[
      bridgeState.beginScan.mock.results.length - 1
    ]?.value;
  });
  rerenderScan();
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

  fireEvent.change(within(dialog).getByLabelText(/first name/i), {
    target: { value: name },
  });
  fireEvent.change(within(dialog).getByLabelText(/^email/i), {
    target: { value: email },
  });
  fireEvent.change(within(dialog).getByLabelText(/^phone/i), {
    target: { value: phone },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: /open my quote preview/i }),
  );
  rerenderScan();
}

describe("ScanLandingExperience", () => {
  it("renders the new hero message, competition stage, reverse-auction, and authority ribbon", () => {
    renderScan();

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
    renderScan();

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

    renderScan();
    fireEvent.click(screen.getByRole("button", { name: /make my quote compete/i }));

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("accepts valid supported files and shows the review CTA", () => {
    const fileReaderSpy = vi.spyOn(globalThis, "FileReader");
    renderScan();

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
    renderScan();
    const input = getUploadInput();

    selectFile(new File([], "empty.pdf", { type: "application/pdf" }), input);
    expect(screen.getByRole("alert")).toHaveTextContent(/empty/i);
    expect(
      screen.queryByRole("button", { name: /review this estimate free/i }),
    ).not.toBeInTheDocument();

    const oversized = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: MAX_PROTOTYPE_BYTES + 1 });
    selectFile(oversized, input);
    expect(screen.getByRole("alert")).toHaveTextContent(/10 mib/i);

    selectFile(new File(["x"], "notes.txt", { type: "text/plain" }), input);
    expect(screen.getByRole("alert")).toHaveTextContent(/unsupported file type/i);
  });

  it("selects the first dropped file when several are dropped", () => {
    renderScan();

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
    renderScan();
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

  it("prevents duplicate scan submission and opens the lead modal after preview readiness", async () => {
    renderScan();
    selectFile(makePdf());

    const reviewButton = screen.getByRole("button", { name: /review this estimate free/i });
    fireEvent.click(reviewButton);
    fireEvent.click(reviewButton);

    await act(async () => {
      await Promise.all(bridgeState.beginScan.mock.results.map((result) => result.value));
    });
    rerenderScan();

    expect(bridgeState.beginScan).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("heading", { name: /your quote preview is ready/i }),
    ).toBeInTheDocument();
  });

  it("shows only first name, email, and phone on the lead form", async () => {
    renderScan();
    selectFile(makePdf());
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceToLeadModal();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/first name/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^email/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^phone/i)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/address/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/contractor/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/openings/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/quoted price/i)).not.toBeInTheDocument();
  });

  it("blocks an invalid lead form and focuses the first invalid field", async () => {
    renderScan();
    selectFile(makePdf());
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceToLeadModal();

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /open my quote preview/i }),
    );

    const alerts = within(dialog).getAllByRole("alert");
    expect(alerts[0]).toHaveTextContent(/first name/i);
    expect(document.activeElement).toBe(within(dialog).getByLabelText(/first name/i));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabaseInvoke).not.toHaveBeenCalled();
  });

  it("opens the live Quote Preview from a valid lead form", async () => {
    renderScan();
    selectFile(makePdf());
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceToLeadModal();

    const dialog = await screen.findByRole("dialog");
    await completeLeadForm(dialog);

    const report = await screen.findByRole("dialog");
    expect(
      within(report).getByText(/real scan preview — full truth report remains locked/i),
    ).toBeInTheDocument();
    expect(
      within(report).queryByText(/demo preview — sample data, not generated from your file/i),
    ).not.toBeInTheDocument();
    expect(within(report).getByText(/^windowman quote preview$/i)).toBeInTheDocument();
    expect(within(report).getByText("Live Windows Co")).toBeInTheDocument();
    expect(within(report).queryByText(/\$28,750/)).not.toBeInTheDocument();
    expect(within(report).queryByText(/^10$/)).not.toBeInTheDocument();
    expect(
      within(report).getByText(/warranty labor coverage is unclear/i),
    ).toBeInTheDocument();
    expect(within(report).getAllByText(/^evidence$/i).length).toBeGreaterThan(0);
    expect(within(report).getAllByText(/why it matters/i).length).toBeGreaterThan(0);
    expect(within(report).getAllByText(/what to ask/i).length).toBeGreaterThan(0);
  });

  it("shows only the local prototype statement for the contractor CTA", async () => {
    renderScan();
    selectFile(makePdf());
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceToLeadModal();

    const lead = await screen.findByRole("dialog");
    await completeLeadForm(lead);

    const report = await screen.findByRole("dialog");
    fireEvent.click(
      within(report).getByRole("button", { name: /prepare my quote for competition/i }),
    );

    expect(
      within(report).getByText(
        /contractor-network preparation will be connected in a later sprint/i,
      ),
    ).toBeInTheDocument();
    expect(within(report).queryByText(/match found/i)).not.toBeInTheDocument();
    expect(within(report).queryByText(/contractor contacted/i)).not.toBeInTheDocument();
  });

  it("resets to idle from RUN ANOTHER ESTIMATE", async () => {
    renderScan();
    selectFile(makePdf("reset-me.pdf"));
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceToLeadModal();

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
    const fileReaderSpy = vi.spyOn(globalThis, "FileReader");
    renderScan();

    fireEvent.click(screen.getByRole("button", { name: /make my quote compete/i }));
    selectFile(makePdf());
    fireEvent.click(screen.getByRole("button", { name: /review this estimate free/i }));
    await advanceToLeadModal();

    const lead = await screen.findByRole("dialog");
    await completeLeadForm(lead);

    expect(fileReaderSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabaseInvoke).not.toHaveBeenCalled();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe("AnalysisSummaryModal preview contract", () => {
  it("shows not-found copy when proof-of-read fields are null", () => {
    render(
      <AnalysisSummaryModal
        open
        preview={{
          ...demoPreview,
          contractorName: null,
          documentType: null,
          openingCountBucket: null,
        }}
        onClose={() => {}}
        onRunAnother={() => {}}
      />,
    );

    expect(screen.getAllByText(/not found in the estimate/i)).toHaveLength(3);
  });

  it("omits null summary metrics and shows zero-findings state", () => {
    render(
      <AnalysisSummaryModal
        open
        preview={{
          ...demoPreview,
          source: "live_preview",
          warningCount: null,
          missingDetailCount: null,
          gradeBand: null,
          findings: [],
        }}
        onClose={() => {}}
        onRunAnother={() => {}}
      />,
    );

    expect(
      screen.getByText(/real scan preview — full truth report remains locked/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/demo preview — sample data, not generated from your file/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/warnings/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/no preview findings are available yet/i),
    ).toBeInTheDocument();
  });

  it("renders at most three findings when more are supplied", () => {
    const extraFinding = {
      id: "extra",
      title: "Extra finding should not render",
      evidence: "Extra evidence",
      importance: "low" as const,
      whyItMatters: "Extra impact",
      recommendedAction: "Extra action",
    };

    render(
      <AnalysisSummaryModal
        open
        preview={{
          ...demoPreview,
          findings: [...demoPreview.findings, extraFinding],
        }}
        onClose={() => {}}
        onRunAnother={() => {}}
      />,
    );

    expect(
      screen.queryByText(/extra finding should not render/i),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/high priority/i).length).toBe(2);
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
