import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConsentBanner from "./consentBanner";

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value,
  });
}

describe("ConsentBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.gtag;
    window.dataLayer = [];
    setScrollY(0);
  });

  it("shows immediately when no consent choice exists", () => {
    render(<ConsentBanner />);

    expect(screen.getByLabelText("Cookie consent")).toBeInTheDocument();
    expect(
      screen.getByText(
        /We use cookies and measurement to improve our experience/i,
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ["Accept", "button"],
    ["Accept cookies and close", "close button"],
  ])("grants consent from the %s", (accessibleName) => {
    const consentChanged = vi.fn();
    window.addEventListener("consentChanged", consentChanged);
    render(<ConsentBanner />);

    fireEvent.click(screen.getByRole("button", { name: accessibleName }));

    expect(window.localStorage.getItem("wg_consent_mode")).toBe("granted");
    expect(consentChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Privacy settings" }),
    ).toBeInTheDocument();

    window.removeEventListener("consentChanged", consentChanged);
  });

  it("denies consent and hides the banner", () => {
    const consentChanged = vi.fn();
    window.addEventListener("consentChanged", consentChanged);
    render(<ConsentBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    expect(window.localStorage.getItem("wg_consent_mode")).toBe("denied");
    expect(consentChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();

    window.removeEventListener("consentChanged", consentChanged);
  });

  it("accepts after a first-time visitor scrolls 200 pixels", () => {
    const consentChanged = vi.fn();
    window.addEventListener("consentChanged", consentChanged);
    render(<ConsentBanner />);

    act(() => {
      setScrollY(199);
      window.dispatchEvent(new Event("scroll"));
    });
    expect(window.localStorage.getItem("wg_consent_mode")).toBeNull();

    act(() => {
      setScrollY(200);
      window.dispatchEvent(new Event("scroll"));
    });

    expect(window.localStorage.getItem("wg_consent_mode")).toBe("granted");
    expect(consentChanged).toHaveBeenCalledTimes(1);

    act(() => {
      setScrollY(500);
      window.dispatchEvent(new Event("scroll"));
    });
    expect(consentChanged).toHaveBeenCalledTimes(1);

    window.removeEventListener("consentChanged", consentChanged);
  });

  it("stays hidden for a stored choice and can be reopened and changed", () => {
    window.localStorage.setItem("wg_consent_mode", "denied");
    render(<ConsentBanner />);

    expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Privacy settings" }),
    );
    expect(screen.getByLabelText("Cookie consent")).toBeInTheDocument();

    act(() => {
      setScrollY(300);
      window.dispatchEvent(new Event("scroll"));
    });
    expect(window.localStorage.getItem("wg_consent_mode")).toBe("denied");

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(window.localStorage.getItem("wg_consent_mode")).toBe("granted");
    expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();
  });
});
