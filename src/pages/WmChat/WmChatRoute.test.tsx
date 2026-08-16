import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import type { ReactNode } from "react";

const submitWmChatLeadSpy = vi.hoisted(() => vi.fn());

vi.mock("@/components/AppTrackingProvider", () => ({
  AppTrackingProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/consentBanner", () => ({ default: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/intake", () => ({ WindowManIntakePreview: () => null }));
vi.mock("@/state/scanFunnel", () => ({
  ScanFunnelProvider: ({ children }: { children: ReactNode }) => children,
  useScanFunnelSafe: () => null,
}));
vi.mock("@/services/wmchatLeadCapture", () => ({
  submitWmChatLead: submitWmChatLeadSpy,
}));
vi.mock("../../pages/Index", () => ({ default: () => <div>Home route</div> }));

import App from "../../App";

const APP_PATH = resolve(process.cwd(), "src/App.tsx");
const SITEMAP_SCRIPT_PATH = resolve(process.cwd(), "scripts/generate-sitemap.ts");
const SITEMAP_PATH = resolve(process.cwd(), "public/sitemap.xml");

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

describe("/wmchat route", () => {
  beforeEach(() => {
    submitWmChatLeadSpy.mockReset();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/wmchat");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
    document.head.querySelector('meta[name="robots"]')?.remove();
  });

  it("lazy-loads and mounts /wmchat exactly once after /nq4 and before /scan and the catch-all", () => {
    const source = readFileSync(APP_PATH, "utf8");
    const routeNeedle = '<Route path="/wmchat" element={<WmChatPage />} />';

    expect(source).toContain(
      'const WmChatPage = lazy(() => import("./pages/WmChat/WmChatPage.tsx"));',
    );
    expect(source.split(routeNeedle)).toHaveLength(2);

    const nq4Index = source.indexOf('<Route path="/nq4"');
    const wmchatIndex = source.indexOf(routeNeedle);
    const scanIndex = source.indexOf('<Route path="/scan"');
    const catchAllIndex = source.indexOf('<Route path="*"');

    expect(nq4Index).toBeGreaterThan(-1);
    expect(wmchatIndex).toBeGreaterThan(nq4Index);
    expect(scanIndex).toBeGreaterThan(wmchatIndex);
    expect(catchAllIndex).toBeGreaterThan(scanIndex);
  });

  it("renders the real route with its locked opening and noindex metadata without submitting", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "WindowMan: Your Quote Hero" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("👋 Hey — I'm WindowMan. Quick one: why'd you click my post?"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(document.title).toBe("WindowMan: Your Quote Hero");
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex,nofollow",
      );
    });

    expect(submitWmChatLeadSpy).not.toHaveBeenCalled();
  });

  it("keeps /wmchat out of the generated sitemap contract", () => {
    expect(readFileSync(SITEMAP_SCRIPT_PATH, "utf8")).not.toContain(
      '{ path: "/wmchat"',
    );
    expect(readFileSync(SITEMAP_PATH, "utf8")).not.toContain(
      "https://windowman.app/wmchat",
    );
  });

  it("does not expose /wmchat through a public source link", () => {
    const routeTestPath = resolve(
      process.cwd(),
      "src/pages/WmChat/WmChatRoute.test.tsx",
    );
    const hardCodedWmChatLink =
      /(?:href|to)\s*=\s*(?:\{\s*)?["'`]\/wmchat(?:[/?#"'`])/;
    const offenders = collectSourceFiles(resolve(process.cwd(), "src"))
      .filter((path) => path !== routeTestPath)
      .filter((path) => hardCodedWmChatLink.test(readFileSync(path, "utf8")));

    expect(offenders).toEqual([]);
  });
});
