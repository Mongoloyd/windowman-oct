import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PublicLayout from "@/components/PublicLayout";
import Privacy from "@/pages/Privacy";
import { PRIVACY_POLICY_URL } from "@/content/privacyPolicyMetadata";

vi.mock("@/components/StickyCTAFooter", () => ({
  default: () => null,
}));

function renderPrivacyRoute() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/privacy"]}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/privacy" element={<Privacy />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("Privacy page", () => {
  it("renders Privacy Policy heading and key disclosures", () => {
    renderPrivacyRoute();
    expect(
      screen.getByRole("heading", { level: 1, name: /Privacy Policy/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Google Gemini/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Meta Conversions API/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/30 days/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/referral fee/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/reasonable administrative, technical, and organizational safeguards/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Privacy Email: support@windowman\.app/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/https:\/\/windowman\.app/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/\[LEGAL ENTITY NAME\]/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/\[BUSINESS MAILING ADDRESS\]/i),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/Meta Pixel/i).length).toBeGreaterThan(0);
  });

  it("exposes Privacy and Terms links in the site footer", () => {
    renderPrivacyRoute();
    const footerPrivacy = screen.getAllByRole("link", { name: /Privacy/i }).find(
      (el) => el.getAttribute("href") === "/privacy",
    );
    const footerTerms = screen.getAllByRole("link", { name: /Terms/i }).find(
      (el) => el.getAttribute("href") === "/terms",
    );
    expect(footerPrivacy).toBeTruthy();
    expect(footerTerms).toBeTruthy();
  });

  it("uses a single public main landmark via PublicLayout", () => {
    const { container } = renderPrivacyRoute();
    expect(container.querySelectorAll("main")).toHaveLength(1);
  });

  it("constrains the policy body with one max-width wrapper and padding", () => {
    const { container } = renderPrivacyRoute();
    const policySection = container.querySelector(
      'section[aria-labelledby="privacy-policy-title"]',
    );
    expect(policySection).toBeTruthy();
    const wrappers = policySection!.querySelectorAll(".max-w-4xl");
    expect(wrappers).toHaveLength(1);
    const wrapper = wrappers[0] as HTMLElement;
    expect(wrapper.className).toContain("mx-auto");
    expect(wrapper.className).toContain("px-4");
    expect(wrapper.className).toContain("py-16");
  });

  it("renders exactly one policy body without duplicated heading", () => {
    const { container } = renderPrivacyRoute();
    expect(
      container.querySelectorAll("#privacy-policy-title"),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("heading", { level: 1, name: /Privacy Policy/i }),
    ).toHaveLength(1);
    expect(container.querySelectorAll("article")).toHaveLength(1);
  });

  it("sets route title and canonical via Helmet", async () => {
    renderPrivacyRoute();
    await waitFor(() => {
      expect(document.title).toContain("WindowMan Privacy Policy");
    });
    await waitFor(() => {
      const canonical = document.querySelector('link[rel="canonical"]');
      expect(canonical?.getAttribute("href")).toBe(PRIVACY_POLICY_URL);
    });
  });

  it("includes WebPage JSON-LD", async () => {
    renderPrivacyRoute();
    await waitFor(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]'),
      );
      const webpage = scripts.find((s) => s.textContent?.includes('"@type":"WebPage"'));
      expect(webpage).toBeTruthy();
    });
  });
});
