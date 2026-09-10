import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_QUOTE } from "./fixture";
import LensVariant from "./LensVariant";
import type { VariantViewModel } from "./types";

const estimatePath = resolve(process.cwd(), "public/images/synthetic-demo/lens/estimate-bg.webp");
const lensSourcePath = resolve(process.cwd(), "src/components/synthetic-demo/LensVariant.tsx");

function viewModel(step = 0, overrides: Partial<VariantViewModel> = {}): VariantViewModel {
  return {
    step,
    signal: SAMPLE_QUOTE.signals[step],
    revealed: false,
    revealedCount: 0,
    reducedMotion: false,
    onReveal: vi.fn(),
    onAnswer: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onPayoff: vi.fn(),
    onHasQuote: vi.fn(),
    ...overrides,
  };
}

function readWebpDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Lens estimate is not a valid WebP container");
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.toString("ascii", offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunk === "VP8X") {
      return {
        width: bytes.readUIntLE(dataOffset + 4, 3) + 1,
        height: bytes.readUIntLE(dataOffset + 7, 3) + 1,
      };
    }
    if (chunk === "VP8 " && bytes.toString("hex", dataOffset + 3, dataOffset + 6) === "9d012a") {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && bytes[dataOffset] === 0x2f) {
      const packed = bytes.readUInt32LE(dataOffset + 1);
      return {
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  throw new Error("Lens estimate WebP has no readable dimensions");
}

afterEach(cleanup);

describe("LensVariant", () => {
  it("renders the portrait fictional estimate with dimensions matching the real WebP", () => {
    render(<LensVariant {...viewModel()} />);

    const image = screen.getByRole("img", { name: /fictional .*estimate/i });
    const dimensions = readWebpDimensions(readFileSync(estimatePath));

    expect(image).toHaveAttribute("src", "/images/synthetic-demo/lens/estimate-bg.webp");
    expect(image).toHaveAttribute("alt", expect.stringMatching(/fictional|synthetic/i));
    expect(Number(image.getAttribute("width"))).toBe(dimensions.width);
    expect(Number(image.getAttribute("height"))).toBe(dimensions.height);
    expect(dimensions).toEqual({ width: 1122, height: 1402 });
  });

  it("places scope, warranty, and fee signals at distinct clause centers", () => {
    const { container, rerender } = render(<LensVariant {...viewModel(0)} />);
    const positions = SAMPLE_QUOTE.signals.map((_, step) => {
      rerender(<LensVariant {...viewModel(step)} />);
      const scene = container.querySelector<HTMLElement>(".sd-lens-scene");
      expect(scene).not.toBeNull();
      return {
        x: scene!.style.getPropertyValue("--sd-lens-x"),
        y: scene!.style.getPropertyValue("--sd-lens-y"),
      };
    });

    expect(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size).toBe(3);
    expect(positions.map(({ y }) => Number.parseFloat(y))).toEqual([...positions.map(({ y }) => Number.parseFloat(y))].sort((a, b) => a - b));
  });

  it("uses the existing reveal callback when the semantic lens button is activated", () => {
    const onReveal = vi.fn();
    render(<LensVariant {...viewModel(0, { onReveal })} />);

    fireEvent.click(screen.getByRole("button", { name: "Inspect installation scope" }));

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("keeps the current finding, explanation, and question understandable without motion", () => {
    const signal = SAMPLE_QUOTE.signals[1];
    const { container } = render(<LensVariant {...viewModel(1, { signal, reducedMotion: true, revealed: true, revealedCount: 2 })} />);

    expect(screen.getByRole("button", { name: "Inspect warranty labor" })).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector(".sd-lens-reading")).toHaveTextContent(signal.finding);
    expect(container.querySelector(".sd-lens-row.is-active")).toHaveTextContent(signal.explanation);
    expect(container.querySelector(".sd-takeaway")).toHaveTextContent(signal.question);
  });

  it("retains previous and next enablement across the three existing steps", () => {
    const { rerender } = render(<LensVariant {...viewModel(0)} />);
    expect(screen.getByRole("button", { name: "Previous signal" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next signal" })).toBeDisabled();

    rerender(<LensVariant {...viewModel(0, { revealed: true, revealedCount: 1 })} />);
    expect(screen.getByRole("button", { name: "Next signal" })).toBeEnabled();

    rerender(<LensVariant {...viewModel(1, { revealed: true, revealedCount: 2 })} />);
    expect(screen.getByRole("button", { name: "Previous signal" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next signal" })).toBeEnabled();

    rerender(<LensVariant {...viewModel(2, { revealed: true, revealedCount: 3 })} />);
    expect(screen.getByRole("button", { name: "Previous signal" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next signal" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reveal my question list" })).toBeEnabled();
  });

  it("remains a presentation-only view over the shared VariantViewModel", () => {
    const source = readFileSync(lensSourcePath, "utf8");
    const imports = source.split(/\r?\n/).filter((line) => line.startsWith("import ")).join("\n");

    expect(imports).not.toMatch(/react-router|\/pages\/|UploadZone|capture/i);
    expect(source).not.toMatch(/\b(?:useState|useReducer|useEffect|createContext)\s*\(/);
    expect(source).toContain("LensVariant(view: VariantViewModel)");
  });
});
