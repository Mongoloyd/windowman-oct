import { afterEach, describe, expect, it } from "vitest";
import {
  activateProphecyDocumentTheme,
  DEFAULT_PUBLIC_THEME_COLOR,
  isProphecyPath,
  PROPHECY_CANVAS_COLOR,
  PROPHECY_THEME_ATTRIBUTE,
} from "./prophecyDocumentTheme";

describe("Prophecy document theme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(PROPHECY_THEME_ATTRIBUTE);
    document.querySelector('meta[name="theme-color"]')?.remove();
  });

  it("recognizes both supported Prophecy route forms only", () => {
    expect(isProphecyPath("/prophecy")).toBe(true);
    expect(isProphecyPath("/prophecy/")).toBe(true);
    expect(isProphecyPath("/prophecy/example")).toBe(false);
    expect(isProphecyPath("/privacy")).toBe(false);
  });

  it("applies the dark marker and restores the public theme on cleanup", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = DEFAULT_PUBLIC_THEME_COLOR;
    meta.dataset.defaultContent = DEFAULT_PUBLIC_THEME_COLOR;
    document.head.appendChild(meta);

    const cleanup = activateProphecyDocumentTheme();

    expect(document.documentElement).toHaveAttribute(
      PROPHECY_THEME_ATTRIBUTE,
      "prophecy",
    );
    expect(meta.content).toBe(PROPHECY_CANVAS_COLOR);

    cleanup();

    expect(document.documentElement).not.toHaveAttribute(
      PROPHECY_THEME_ATTRIBUTE,
    );
    expect(meta.content).toBe(DEFAULT_PUBLIC_THEME_COLOR);
  });
});
