/**
 * Sprint 1 contract for the `/scan` visual foundation.
 *
 * Proves the landing page renders, the hero CTA reaches the upload surface,
 * the upload surface stays inert (no read, no upload, no network), and the
 * route is only reachable through the exact `VITE_SCAN_ROUTE_MOUNTED` flag —
 * asserted against the real `App` route graph, not a duplicated harness.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ScanLandingExperience from "./ScanLandingExperience";

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
// jsdom does not implement scrollIntoView, so stand in with a typed mock.
const scrollIntoViewSpy = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
  Element.prototype.scrollIntoView = scrollIntoViewSpy;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function getUploadInput() {
  return screen.getByLabelText(/drop your estimate here for ai review/i) as HTMLInputElement;
}

describe("ScanLandingExperience", () => {
  it("renders the hero, flow card, upload surface, value band, and footer", () => {
    render(<ScanLandingExperience />);

    expect(
      screen.getByRole("heading", { level: 1, name: /tired of confusing estimates\?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /get my free estimate review/i }),
    ).toBeInTheDocument();

    expect(screen.getByText(/upload estimate/i)).toBeInTheDocument();
    expect(screen.getByText(/summary report/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /unbiased second opinion/i }),
    ).toBeInTheDocument();

    expect(getUploadInput()).toBeInTheDocument();
    expect(screen.getByText(/pdf, jpg, png, or webp — up to 15 mib/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /free\. instant\. unbiased\./i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/independent quote-review service/i),
    ).toBeInTheDocument();
  });

  it("scrolls to the upload surface and focuses the upload control from the hero CTA", () => {
    render(<ScanLandingExperience />);

    fireEvent.click(screen.getByRole("button", { name: /get my free estimate review/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /get my free estimate review/i }));

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("shows a selected filename without reading, uploading, or transmitting the file", () => {
    const fileReaderSpy = vi.spyOn(globalThis, "FileReader");
    render(<ScanLandingExperience />);

    const input = getUploadInput();
    const file = new File(["quote"], "a-very-long-contractor-estimate-filename-2026.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(
      screen.getByText("a-very-long-contractor-estimate-filename-2026.pdf"),
    ).toBeInTheDocument();
    // Input is cleared so re-picking the same file still fires a change event.
    expect(input.value).toBe("");
    expect(fileReaderSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabaseInvoke).not.toHaveBeenCalled();
  });

  it("issues no network or backend calls on render or CTA interaction", () => {
    render(<ScanLandingExperience />);
    fireEvent.click(screen.getByRole("button", { name: /get my free estimate review/i }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(supabaseInvoke).not.toHaveBeenCalled();
    expect(window.dataLayer).toBeUndefined();
  });
});

describe("/scan route mount flag", () => {
  async function renderAppAtScan(flagValue: string) {
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
        screen.getByRole("heading", { level: 1, name: /tired of confusing estimates\?/i }),
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
        screen.queryByRole("heading", { name: /tired of confusing estimates\?/i }),
      ).not.toBeInTheDocument();
    },
  );
});
