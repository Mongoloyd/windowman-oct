import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VisualOracleLab from "./VisualOracleLab";

vi.mock("react-helmet-async", () => ({ Helmet: () => null }));

vi.mock("@/components/admin/oracle", () => ({
  OracleDashboardSurface: () => <div>Operator cockpit surface</div>,
  OracleDataLabSurface: () => <div>Data lab surface</div>,
}));

vi.mock("@/features/intelligence-console/InternalIntelligenceConsole", () => ({
  InternalIntelligenceConsole: () => <div>Foundation console surface</div>,
}));

vi.mock("@/features/intelligence", () => ({
  INTERNAL_INTELLIGENCE_FIXTURE: {},
  PUBLIC_ORACLE_VIEW_MODEL: {},
  IntelligenceConsoleSurface: () => <div>Observatory console surface</div>,
  PublicOracleSurface: () => <div>Public Oracle surface</div>,
}));

describe("VisualOracleLab shared shell", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the synthetic status visible and uses a roving tab stop", () => {
    render(<VisualOracleLab />);

    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "Visual Lab · Synthetic Data · Not Live Market",
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    tabs.slice(1).forEach((tab) => expect(tab).toHaveAttribute("tabindex", "-1"));
  });

  it("supports arrow, Home, and End navigation without leaving the governed shell", () => {
    render(<VisualOracleLab />);

    const publicTab = screen.getByRole("tab", { name: "Public Oracle" });
    publicTab.focus();
    fireEvent.keyDown(publicTab, { key: "ArrowRight" });

    const observatoryTab = screen.getByRole("tab", { name: "Observatory Console" });
    expect(observatoryTab).toHaveAttribute("aria-selected", "true");
    expect(observatoryTab).toHaveFocus();
    expect(screen.getByText("Observatory console surface")).toBeInTheDocument();
    expect(screen.getByText(/DomainMetric Adapter Pass Pending/i)).toBeInTheDocument();

    fireEvent.keyDown(observatoryTab, { key: "End" });
    const dataLabTab = screen.getByRole("tab", { name: "Data Lab" });
    expect(dataLabTab).toHaveAttribute("aria-selected", "true");
    expect(dataLabTab).toHaveFocus();

    fireEvent.keyDown(dataLabTab, { key: "Home" });
    expect(publicTab).toHaveAttribute("aria-selected", "true");
    expect(publicTab).toHaveFocus();
  });
});
