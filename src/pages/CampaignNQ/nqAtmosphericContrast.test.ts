import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scopeNq3Css } from "@/pages/CampaignNQ3/scopeNq3Css";

/**
 * Contrast guard for the NQ3/NQ4 atmospheric depth layer.
 *
 * The atmospheric layers are translucent washes painted behind body copy, so every
 * alpha added to them lightens the composited backdrop and lowers text contrast. This
 * test flattens the worst physically-possible stack of those washes over each exposed
 * page base and asserts the weakest text token still clears a floor set deliberately
 * above the WCAG AA 4.5:1 minimum, so the design keeps real headroom rather than
 * sitting one rounding error from failure.
 *
 * Opaque surfaces (--panel, --nq4-panel, the intake dialog) are excluded on purpose:
 * a descendant's own background paints above a negative-z-index pseudo-element, so the
 * atmosphere never reaches text sitting on them.
 */

/** Deliberately above the 4.5:1 AA floor for normal text. This is the safety margin. */
const CONTRAST_FLOOR = 5;

type Rgb = { r: number; g: number; b: number };
type Rgba = Rgb & { a: number };

/**
 * Reads a stylesheet with comments stripped. These files document the alpha budget and
 * the `@property` pitfall in prose that quotes real CSS, so scanning the raw text would
 * match declarations that are only being discussed, not applied.
 */
function readCss(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function declarationOf(css: string, token: string): string {
  const match = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(css);
  if (!match) throw new Error(`${token} is not declared`);
  return match[1].trim();
}

function parseHex(value: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) throw new Error(`Expected a 6-digit hex colour, received "${value}"`);
  const int = Number.parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function parseRgba(value: string): Rgba {
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/i
    .exec(value.trim());
  if (!match) throw new Error(`Expected an rgba() colour, received "${value}"`);
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

/** Source-over compositing of one translucent layer onto an opaque backdrop. */
function composite(layer: Rgba, backdrop: Rgb): Rgb {
  return {
    r: layer.r * layer.a + backdrop.r * (1 - layer.a),
    g: layer.g * layer.a + backdrop.g * (1 - layer.a),
    b: layer.b * layer.a + backdrop.b * (1 - layer.a),
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (raw: number) => {
    const srgb = raw / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)]
    .sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Every wash layer stacked at full strength on the same pixel. This is stricter than
 * reality — NQ3's cone is confined to the hero and can never overlap footer copy — but
 * a spatial argument is not something a stylesheet test can verify, so the bound stays
 * pessimistic on purpose.
 */
function worstCaseBackdrop(base: Rgb, washes: Rgba[]): Rgb {
  return washes.reduce<Rgb>((backdrop, wash) => composite(wash, backdrop), base);
}

describe("NQ atmospheric layer contrast budget", () => {
  const pages = [
    {
      name: "NQ3",
      css: readCss("src/pages/CampaignNQ3/nq-landing.css"),
      bases: ["--bg", "--bg-2"],
      washes: ["--atmo-grid-line", "--atmo-pool", "--atmo-cone"],
      textTokens: ["--txt", "--txt-2", "--txt-3", "--txt-hero"],
    },
    {
      name: "NQ4",
      css: readCss("src/pages/CampaignNQ4/nq4-landing.css"),
      bases: ["--nq4-bg", "--nq4-bg-alt"],
      washes: ["--nq4-atmo-stile-line", "--nq4-atmo-band"],
      textTokens: ["--nq4-text", "--nq4-text-muted", "--nq4-text-dim", "--nq4-text-lead"],
    },
  ] as const;

  for (const page of pages) {
    describe(page.name, () => {
      const washes = page.washes.map((token) => parseRgba(declarationOf(page.css, token)));

      it("keeps every wash layer translucent so none of them can hide content", () => {
        for (const [index, wash] of washes.entries()) {
          expect(wash.a, `${page.washes[index]} must stay translucent`)
            .toBeGreaterThan(0);
          expect(wash.a, `${page.washes[index]} must stay a sensed wash, not a surface`)
            .toBeLessThanOrEqual(0.05);
        }
      });

      for (const baseToken of page.bases) {
        const base = parseHex(declarationOf(page.css, baseToken));
        const backdrop = worstCaseBackdrop(base, washes);

        for (const textToken of page.textTokens) {
          it(`holds ${textToken} above ${CONTRAST_FLOOR}:1 over ${baseToken} with every wash stacked`, () => {
            const ratio = contrastRatio(parseHex(declarationOf(page.css, textToken)), backdrop);
            expect(
              ratio,
              `${textToken} over ${baseToken} composited under ${page.washes.join(" + ")}`,
            ).toBeGreaterThanOrEqual(CONTRAST_FLOOR);
          });
        }
      }
    });
  }

  it("keeps page-level controls opaque so their border ratio cannot depend on the atmosphere", () => {
    const nq3 = readCss("src/pages/CampaignNQ3/nq-landing.css");
    const nq4 = readCss("src/pages/CampaignNQ4/nq4-landing.css");

    expect(declarationOf(nq3, "--control-fill")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(nq3).toMatch(/\.zip-form\{[^}]*background:var\(--control-fill\)/);
    // The pre-atmosphere translucent fill let the .final blue radial lighten the
    // interior until --control-border measured 2.92:1.
    expect(nq3).not.toMatch(/\.zip-form\{[^}]*background:rgba\(255,\s*255,\s*255/);
    expect(nq4).toMatch(/\.nq4-zip-input\s*\{[^}]*background:\s*var\(--nq4-bg-alt\)/);

    const border = parseHex(declarationOf(nq3, "--control-border"));
    expect(contrastRatio(border, parseHex(declarationOf(nq3, "--control-fill"))))
      .toBeGreaterThanOrEqual(3);
    expect(contrastRatio(
      parseHex(declarationOf(nq4, "--nq4-control-border")),
      parseHex(declarationOf(nq4, "--nq4-bg-alt")),
    )).toBeGreaterThanOrEqual(3);
  });

  describe("decorative layer safety", () => {
    const layers = [
      {
        name: "NQ3",
        css: readCss("src/pages/CampaignNQ3/nq-landing.css"),
        animatedProperties: ["--lit-x", "--lit-y"],
        decorativeRules: [
          "main::before{",
          "main::after{",
          ".hero::after{",
          ".sec-how::before,",
        ],
      },
      {
        name: "NQ4",
        css: readCss("src/pages/CampaignNQ4/nq4-landing.css"),
        animatedProperties: ["--nq4-scan-progress"],
        decorativeRules: [
          ".nq4-root::before {",
          ".nq4-root::after {",
          ".nq4-root main > section::before {",
        ],
      },
    ] as const;

    /**
     * Strips CSS comments. The prose above each illumination rule names the
     * `inherits: false` anti-pattern it warns against, which a naive search for that
     * pattern would otherwise match as a false positive.
     */
    function withoutComments(css: string): string {
      return css.replace(/\/\*[\s\S]*?\*\//g, "");
    }

    /** Body of the first rule opened by the given literal selector fragment. */
    function ruleBody(css: string, selectorFragment: string): string {
      const start = css.indexOf(selectorFragment);
      if (start === -1) throw new Error(`No rule found for "${selectorFragment}"`);
      const open = css.indexOf("{", start);
      const close = css.indexOf("}", open);
      return css.slice(open + 1, close).replace(/\s+/g, "");
    }

    for (const layer of layers) {
      describe(layer.name, () => {
        it("makes every decorative layer non-interactive and paints it behind content", () => {
          for (const selector of layer.decorativeRules) {
            const body = ruleBody(layer.css, selector);
            expect(body, `${selector} must swallow no pointer events`)
              .toContain("pointer-events:none");
            expect(body, `${selector} must sit behind page content`)
              .toMatch(/z-index:-\d/);
          }
        });

        it("builds every decorative layer from a pseudo-element, so it adds no DOM", () => {
          for (const selector of layer.decorativeRules) {
            expect(selector).toMatch(/::(before|after)/);
            expect(ruleBody(layer.css, selector)).toContain('content:""');
          }
        });

        it("loads no asset and issues no network request for the atmosphere", () => {
          for (const selector of layer.decorativeRules) {
            expect(ruleBody(layer.css, selector)).not.toContain("url(");
          }
        });

        /**
         * A pseudo-element inherits from its originating element, so a custom property
         * registered `inherits: false` computes to its initial value inside `::before`
         * and `::after`. Every layer here is a pseudo-element, so registering these
         * properties that way would freeze the light in place while still looking
         * correct in the stylesheet. Guard against that regression.
         */
        it("leaves the animated custom properties inheriting so pseudo-elements can read them", () => {
          for (const property of layer.animatedProperties) {
            const registration = new RegExp(
              `@property\\s+${property}\\s*\\{([^}]*)\\}`,
            ).exec(withoutComments(layer.css));
            if (registration) {
              expect(
                registration[1].replace(/\s+/g, ""),
                `${property} is read by a pseudo-element, so it must not be non-inheriting`,
              ).not.toContain("inherits:false");
            }
          }
        });

        it("declares a resting value for every animated property before the hook runs", () => {
          for (const property of layer.animatedProperties) {
            expect(layer.css, `${property} needs a declared resting value`)
              .toMatch(new RegExp(`${property}\\s*:\\s*-?[\\d.]`));
          }
        });

        it("neutralises the atmosphere for reduced motion, raised contrast, and forced colours", () => {
          expect(layer.css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
          expect(layer.css).toMatch(/@media\s*\(prefers-contrast:\s*more\)/);
          expect(layer.css).toMatch(/@media\s*\(forced-colors:\s*active\)/);
        });
      });
    }
  });

  /**
   * scopeNq3Css rewrites selectors with a regex that treats everything preceding an
   * opening brace as a selector list. A brace inside a comment therefore consumes the
   * rule that follows it. When that happened to the comment above `:root`, the entire
   * design-token block was swallowed and every token on the page — `--bg` included —
   * computed to empty, with no build error and no other failing test.
   */
  it("keeps braces out of comments so the route scoper cannot swallow a rule", () => {
    const nq3 = readCss("src/pages/CampaignNQ3/nq-landing.css");

    for (const comment of nq3.match(/\/\*[\s\S]*?\*\//g) ?? []) {
      expect(
        /[{}]/.test(comment),
        `A comment contains a brace, which breaks scopeNq3Css: ${comment.slice(0, 90)}…`,
      ).toBe(false);
    }

    // The token block must survive scoping and still carry the page base colour.
    const scoped = scopeNq3Css(nq3);
    expect(scoped).toMatch(/\[data-page="campaign-nq3"\]\{[^}]*--bg:#05070d/);
  });

  it("proves the guard actually bites when an alpha budget is overspent", () => {
    const base = { r: 5, g: 7, b: 13 };
    const overspent = worstCaseBackdrop(base, [
      { r: 180, g: 214, b: 255, a: 0.2 },
      { r: 180, g: 214, b: 255, a: 0.2 },
    ]);
    expect(contrastRatio({ r: 132, g: 150, b: 171 }, overspent)).toBeLessThan(CONTRAST_FLOOR);
  });
});
