import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConsentBanner from "./consentBanner";

const APPROVED_MESSAGE =
  "We use cookies and measurement to improve your experience. You can accept or decline measurement.";

const originalLocalStorage = window.localStorage;

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value,
  });
}

function restoreLocalStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: originalLocalStorage,
  });
}

function getConsentUpdateEvents() {
  return (window.dataLayer || []).filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "event" in entry &&
      (entry as { event?: string }).event === "consent_update",
  );
}

function getGtagConsentUpdates() {
  return (window.dataLayer || []).filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const args = entry as { 0?: string; 1?: string };
    return args[0] === "consent" && args[1] === "update";
  });
}

describe("ConsentBanner", () => {
  beforeEach(() => {
    restoreLocalStorage();
    window.localStorage.clear();
    delete window.gtag;
    window.dataLayer = [];
    setScrollY(0);
  });

  afterEach(() => {
    restoreLocalStorage();
  });

  it("shows immediately when no consent choice exists", () => {
    render(<ConsentBanner />);

    expect(screen.getByLabelText("Cookie consent")).toBeInTheDocument();
    expect(screen.getByText(APPROVED_MESSAGE)).toBeInTheDocument();
  });

  it.each(["granted", "denied"] as const)(
    "hides the banner when stored consent is %s",
    (mode) => {
      window.localStorage.setItem("wg_consent_mode", mode);
      render(<ConsentBanner />);

      expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();
      expect(screen.queryByText("Privacy settings")).not.toBeInTheDocument();
    },
  );

  it("treats an invalid stored value as undecided", () => {
    window.localStorage.setItem("wg_consent_mode", "invalid");
    render(<ConsentBanner />);

    expect(screen.getByLabelText("Cookie consent")).toBeInTheDocument();
    expect(screen.getByText(APPROVED_MESSAGE)).toBeInTheDocument();
  });

  it("does not grant consent from scrolling beyond 200px", () => {
    const consentChanged = vi.fn();
    window.addEventListener("consentChanged", consentChanged);
    render(<ConsentBanner />);

    act(() => {
      setScrollY(250);
      window.dispatchEvent(new Event("scroll"));
    });

    expect(window.localStorage.getItem("wg_consent_mode")).toBeNull();
    expect(consentChanged).not.toHaveBeenCalled();
    expect(getGtagConsentUpdates()).toHaveLength(0);
    expect(getConsentUpdateEvents()).toHaveLength(0);
    expect(screen.getByLabelText("Cookie consent")).toBeInTheDocument();

    window.removeEventListener("consentChanged", consentChanged);
  });

  it("has no X or dismiss-as-accept control", () => {
    render(<ConsentBanner />);

    expect(
      screen.queryByRole("button", { name: /Accept cookies and close/i }),
    ).toBeNull();
    expect(screen.queryByLabelText(/Accept cookies and close/i)).toBeNull();
    expect(document.querySelector("svg.lucide-x")).toBeNull();
  });

  it("grants consent from Accept only", () => {
    const consentChanged = vi.fn();
    window.addEventListener("consentChanged", consentChanged);
    render(<ConsentBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(window.localStorage.getItem("wg_consent_mode")).toBe("granted");
    expect(consentChanged).toHaveBeenCalledTimes(1);
    expect(getGtagConsentUpdates().length).toBeGreaterThan(0);
    expect(getConsentUpdateEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "consent_update",
          consent_choice: "accepted",
          consent_type: "all",
        }),
      ]),
    );
    expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();
    expect(screen.queryByText("Privacy settings")).not.toBeInTheDocument();

    window.removeEventListener("consentChanged", consentChanged);
  });

  it("declines via a small link-style text action, not a button", () => {
    const consentChanged = vi.fn();
    window.addEventListener("consentChanged", consentChanged);
    render(<ConsentBanner />);

    const decline = screen.getByRole("link", { name: "Decline" });
    expect(decline.tagName).toBe("A");
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();

    fireEvent.click(decline);

    expect(window.localStorage.getItem("wg_consent_mode")).toBe("denied");
    expect(consentChanged).toHaveBeenCalledTimes(1);
    expect(getGtagConsentUpdates().length).toBeGreaterThan(0);
    expect(getConsentUpdateEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "consent_update",
          consent_choice: "rejected",
          consent_type: "all",
        }),
      ]),
    );
    expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();
    expect(screen.queryByText("Privacy settings")).not.toBeInTheDocument();

    window.removeEventListener("consentChanged", consentChanged);
  });

  it("renders the exact approved message and no implicit-consent copy", () => {
    render(<ConsentBanner />);

    expect(screen.getByText(APPROVED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/By using the site you agree/i)).toBeNull();
    expect(screen.queryByText(/continuing to use/i)).toBeNull();
    expect(screen.queryByText(/using the site/i)).toBeNull();
  });

  it("keeps all consent UI hidden for a stored choice", () => {
    window.localStorage.setItem("wg_consent_mode", "denied");
    render(<ConsentBanner />);

    expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("wg_consent_mode")).toBe("denied");
    expect(screen.queryByText("Privacy settings")).not.toBeInTheDocument();
  });

  it("keeps the banner open and fail-closed when setItem throws", () => {
    const consentChanged = vi.fn();
    window.addEventListener("consentChanged", consentChanged);

    const memory = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
        removeItem: (key: string) => {
          memory.delete(key);
        },
        clear: () => memory.clear(),
        key: (index: number) => Array.from(memory.keys())[index] ?? null,
        get length() {
          return memory.size;
        },
      },
    });

    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(window.localStorage.getItem("wg_consent_mode")).toBeNull();
    expect(consentChanged).not.toHaveBeenCalled();
    expect(getGtagConsentUpdates()).toHaveLength(0);
    expect(getConsentUpdateEvents()).toHaveLength(0);
    expect(screen.getByLabelText("Cookie consent")).toBeInTheDocument();
    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Unable to save your choice. Please try again.");

    window.removeEventListener("consentChanged", consentChanged);
  });

  it("clears the persistence error after a successful retry", () => {
    const memory = new Map<string, string>();
    let failNextWrite = true;

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (failNextWrite) {
            failNextWrite = false;
            throw new Error("quota exceeded");
          }
          memory.set(key, String(value));
        },
        removeItem: (key: string) => {
          memory.delete(key);
        },
        clear: () => memory.clear(),
        key: (index: number) => Array.from(memory.keys())[index] ?? null,
        get length() {
          return memory.size;
        },
      },
    });

    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.localStorage.getItem("wg_consent_mode")).toBe("granted");
    expect(screen.queryByLabelText("Cookie consent")).not.toBeInTheDocument();
    expect(screen.queryByText("Privacy settings")).not.toBeInTheDocument();
  });

  it("shows the banner and stays fail-closed when getItem throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("storage blocked");
        },
        setItem: () => {
          throw new Error("storage blocked");
        },
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      },
    });

    render(<ConsentBanner />);

    expect(screen.getByLabelText("Cookie consent")).toBeInTheDocument();
    expect(screen.getByText(APPROVED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("Privacy settings")).not.toBeInTheDocument();
  });
});
