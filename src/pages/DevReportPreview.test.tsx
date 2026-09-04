import { render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DevReportPreview from "./DevReportPreview";

describe("DevReportPreview evidence-summary fixture plumbing", () => {
  it("renders safe qualitative preview context without numeric pillar details", () => {
    const { container } = render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/dev/report-preview?v=v3&mode=preview"]}>
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );

    const summary = screen.getByLabelText("Document evidence summary");
    expect(summary).toHaveTextContent(
      "We read BrightView Window’s quote and found 18 items worth reviewing before you sign.",
    );
    expect(summary).toHaveTextContent("14openings detected");
    expect(summary).toHaveTextContent("1page read");
    expect(summary).toHaveTextContent("3quoted line items parsed");
    expect(screen.queryByRole("list", { name: /five-pillar/i })).not.toBeInTheDocument();
    const bento = screen.getByLabelText("Quote analysis snapshot");
    expect(within(bento).getByText(/We analyzed BrightView Window’s estimate/)).toBeInTheDocument();
    expect(within(bento).getByText("Safety & Code")).toBeInTheDocument();
    expect(within(bento).getByText("Installation Scope")).toBeInTheDocument();
    expect(screen.getByText("Warranty terms").parentElement).toHaveTextContent(
      "Not documented in quote",
    );
    expect(screen.getByText("Permit language").parentElement).toHaveTextContent(
      "Not documented in quote",
    );

    for (const protectedDetail of [
      "34",
      "41",
      "82",
      "29",
      "62",
      "Missing NOA/FL approval numbers.",
      "Permit responsibility and exclusions are not clear.",
    ]) {
      expect(summary).not.toHaveTextContent(protectedDetail);
    }
    expect(container).not.toHaveTextContent(
      /per-pillar issue|category results are temporarily unavailable/i,
    );
  });

  const scenarios = [
    {
      id: "typical",
      expectedText: [/Safety & Code/i, /Price Clarity/i],
      band: "Typical",
    },
    {
      id: "disaster",
      expectedText: [/Safety & Code/i, /Installation Scope/i],
      band: "Elevated",
    },
    {
      id: "perfect",
      expectedText: [/All five documented quote categories appear clear/i],
      band: "Lower",
    },
    {
      id: "missing-data",
      expectedText: [/Category-level review is not available/i],
      band: null,
    },
    {
      id: "price-warning",
      expectedText: [/Price Clarity/i],
      band: "Elevated",
    },
    {
      id: "long-name",
      expectedText: [/Southeast Florida Architectural Impact Window/i, /Fine Print/i],
      band: "Typical",
    },
  ] as const;

  for (const scenario of scenarios) {
    it(`renders the sanitized ${scenario.id} visual scenario`, () => {
      render(
        <HelmetProvider>
          <MemoryRouter
            initialEntries={[
              `/dev/report-preview?v=v3&mode=preview&scenario=${scenario.id}`,
            ]}
          >
            <DevReportPreview />
          </MemoryRouter>
        </HelmetProvider>,
      );

      const bento = screen.getByLabelText("Quote analysis snapshot");
      for (const expected of scenario.expectedText) {
        expect(within(bento).getByText(expected)).toBeInTheDocument();
      }
      if (scenario.band != null) {
        expect(
          within(bento).getByRole("img", {
            name: `Quote price band: ${scenario.band}`,
          }),
        ).toBeInTheDocument();
      }

      if (scenario.id === "missing-data") {
        expect(within(bento).queryByText("Quote price band")).not.toBeInTheDocument();
        expect(within(bento).queryByText("Warranty terms")).not.toBeInTheDocument();
        expect(within(bento).queryByText("Permit language")).not.toBeInTheDocument();
      }
    });
  }

  it("restores representative aggregate counts for the typical sandbox scenario", () => {
    render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={["/dev/report-preview?v=v3&mode=preview&scenario=typical"]}
        >
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.getByLabelText("Document evidence summary")).toHaveTextContent(
      "We read BrightView Window’s quote and found 18 items worth reviewing before you sign.",
    );
    expect(screen.getByText("Material Quote Concerns").parentElement).toHaveTextContent(
      "9Material Quote Concerns",
    );
    expect(screen.getByText("Clarifications Needed").parentElement).toHaveTextContent(
      "9Clarifications Needed",
    );
    expect(
      screen.getByText(
        "We found 18 items worth reviewing in this quote before signing or comparing estimates.",
      ),
    ).toBeInTheDocument();
  });

  it("falls back to the immutable canonical fixture for an unknown scenario", () => {
    render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={[
            "/dev/report-preview?v=v3&mode=preview&scenario=not-a-real-scenario",
          ]}
        >
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );

    const bento = screen.getByLabelText("Quote analysis snapshot");
    expect(within(bento).getByText(/We analyzed BrightView Window’s estimate/)).toBeInTheDocument();
    expect(within(bento).getByRole("img", { name: "Quote price band: Lower" })).toBeInTheDocument();
    expect(within(bento).getByText("Safety & Code")).toBeInTheDocument();
    expect(within(bento).getByText("Installation Scope")).toBeInTheDocument();
  });

  it("does not apply preview scenarios to the full fixture", () => {
    render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={[
            "/dev/report-preview?v=v3&mode=full&scenario=missing-data",
          ]}
        >
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.queryByLabelText("Quote analysis snapshot")).not.toBeInTheDocument();
    expect(screen.getByText("▦ PLAIN-ENGLISH SUMMARY")).toBeInTheDocument();
    expect(screen.queryByText(/Category-level review is not available/i)).not.toBeInTheDocument();
  });

  it("mirrors the authorized production report with the WindowMan summary bridge", () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/dev/report-preview?v=v3&mode=full&scenario=typical"]}>
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );

    const bridge = screen.getByRole("region", { name: "Get a better quote" });
    expect(within(bridge).getByRole("img", { name: /WindowMan prescription/i })).toBeInTheDocument();
    expect(bridge).toHaveTextContent(
      "WindowMan found that this estimate does not document design-pressure ratings",
    );
    expect(bridge).toHaveTextContent("WindowMan can help you get a quote that fixes these issues.");
  });

  it("keeps the WindowMan full-report bridge out of preview and unauthorized modes", () => {
    const preview = render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/dev/report-preview?v=v3&mode=preview"]}>
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(screen.queryByRole("region", { name: "Get a better quote" })).not.toBeInTheDocument();
    preview.unmount();

    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/dev/report-preview?v=v3&mode=unauthorized"]}>
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(screen.queryByRole("region", { name: "Get a better quote" })).not.toBeInTheDocument();
  });

  it("does not apply preview scenarios to unauthorized or live-source paths", () => {
    const unauthorized = render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={[
            "/dev/report-preview?v=v3&mode=unauthorized&scenario=perfect",
          ]}
        >
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.getByText("Unauthorized Full Reveal")).toBeInTheDocument();
    expect(screen.queryByLabelText("Quote analysis snapshot")).not.toBeInTheDocument();
    unauthorized.unmount();

    render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={[
            "/dev/report-preview?v=v3&mode=preview&source=live&scenario=perfect",
          ]}
        >
          <DevReportPreview />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(screen.queryByLabelText("Quote analysis snapshot")).not.toBeInTheDocument();
    expect(screen.queryByText(/All five documented quote categories appear clear/i)).not.toBeInTheDocument();
  });
});
