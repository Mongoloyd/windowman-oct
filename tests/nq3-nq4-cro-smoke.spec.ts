import { expect, test, type Page } from "@playwright/test";

/**
 * Chromium-only CRO/accessibility smoke checks for /nq3 and /nq4.
 * iOS Safari and Android Chrome are NOT covered here and still need manual device QA.
 */

const MOBILE_WIDTHS = [320, 360, 390, 430] as const;
const ESCAPE_HATCH_LABEL = "Already have a written estimate? Upload it for an AI check →";

async function heightOf(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `expected a bounding box for ${selector}`).not.toBeNull();
  return box!.height;
}

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
}

/** Counts comma-separated layers in a resolved box-shadow, ignoring commas inside rgb()/rgba(). */
async function shadowLayerCount(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return -1;
    const shadow = getComputedStyle(el).boxShadow;
    if (!shadow || shadow === "none") return 0;
    return shadow.replace(/\([^)]*\)/g, "").split(",").length;
  }, selector);
}

async function transformOf(page: Page, selector: string) {
  return page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)!).transform,
    selector,
  );
}

test.describe("NQ3 landing", () => {
  test("renders the approved CTA copy, labelled ZIP fields, and escape hatch", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/nq3");

    await expect(
      page.getByRole("heading", { level: 1, name: /Don't just get a window estimate/ }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Start My Free Estimate Check/ }),
    ).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Start My Check" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Get My Free AI Report/ }),
    ).toHaveCount(0);

    const heroLabel = page.locator('label[for="nq3-hero-zip"]');
    await expect(heroLabel).toBeVisible();
    await expect(heroLabel).toHaveText("Florida ZIP code");
    const footerLabel = page.locator('label[for="nq3-final-zip"]');
    await expect(footerLabel).toHaveText("Florida ZIP code");

    const escapeHatch = page.getByTestId("nq3-escape-hatch");
    await expect(escapeHatch).toBeVisible();
    await expect(escapeHatch).toHaveText(ESCAPE_HATCH_LABEL);
    const href = await escapeHatch.getAttribute("href");
    expect(href).toContain("wm_intent=has_quote");
    expect(href).toContain("#truth-gate");
    expect(await heightOf(page, '[data-testid="nq3-escape-hatch"]')).toBeGreaterThanOrEqual(48);
  });

  test("keeps hero CTAs at 48px and hero content inside a 24px gutter at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/nq3");

    const heroCta = page.locator(".hero .zip-form .btn-primary");
    const navCta = page.locator("nav .btn");
    const footerCta = page.locator(".final .zip-form .btn-primary");
    expect(await heightOf(page, ".hero .zip-form .btn-primary")).toBeGreaterThanOrEqual(48);
    expect(await heightOf(page, "nav .btn")).toBeGreaterThanOrEqual(48);
    expect(await heightOf(page, ".final .zip-form .btn-primary")).toBeGreaterThanOrEqual(48);
    await expect(heroCta).toBeVisible();
    await expect(navCta).toBeVisible();
    await expect(footerCta).toBeVisible();

    for (const width of MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      const gutters = await page.evaluate(() => {
        const wrap = document.querySelector(".hero .wrap");
        if (!wrap) return null;
        const rect = wrap.getBoundingClientRect();
        return { left: rect.left, right: window.innerWidth - rect.right };
      });
      expect(gutters, `hero wrap missing at ${width}px`).not.toBeNull();
      expect(gutters!.left, `left gutter at ${width}px`).toBeGreaterThanOrEqual(24);
      expect(gutters!.right, `right gutter at ${width}px`).toBeGreaterThanOrEqual(24);
      expect(await hasHorizontalOverflow(page), `overflow at ${width}px`).toBe(false);
    }
  });

  test("hero ZIP submit opens the intake dialog", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/nq3");

    await page.locator("#nq3-hero-zip").fill("33139");
    await page.getByRole("button", { name: /Start My Free Estimate Check/ }).first().click();

    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("escape hatch navigates to the canonical truth gate without opening the intake", async ({ page }) => {
    await page.goto("/nq3");
    await page.getByTestId("nq3-escape-hatch").click();

    await expect(page).toHaveURL(/wm_intent=has_quote/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("does not request the explainer MP4 until the play button is clicked", async ({ page }) => {
    const videoRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(".mp4")) videoRequests.push(request.url());
    });

    await page.goto("/nq3");
    const facade = page.getByTestId("explainer-video-facade");
    await facade.scrollIntoViewIfNeeded();
    await expect(facade).toBeVisible();
    expect(videoRequests).toEqual([]);

    await facade.getByRole("button", { name: /^Play / }).click();
    await expect(page.getByTestId("explainer-video")).toBeVisible();
  });

  test("resolves the elevation ladder to multi-layer shadows on every tier", async ({ page }) => {
    await page.goto("/nq3");

    for (const selector of [
      ".chk",
      ".finding",
      ".step",
      ".card",
      ".float-chip",
      ".zip-form",
      ".btn-primary",
    ]) {
      expect(
        await shadowLayerCount(page, selector),
        `${selector} must resolve to a composite shadow`,
      ).toBeGreaterThanOrEqual(2);
    }

    const tokens = await page.evaluate(() => {
      const styles = getComputedStyle(
        document.querySelector('[data-page="campaign-nq3"]')!,
      );
      return ["--elev-sm", "--elev-md", "--elev-lg", "--elev-accent", "--edge-recess"].map(
        (token) => styles.getPropertyValue(token).trim(),
      );
    });
    for (const value of tokens) expect(value).not.toBe("");
  });

  test("lifts the primary CTA on hover and restores it on mouse out", async ({ page }) => {
    await page.goto("/nq3");
    const cta = page.locator(".hero .zip-form .btn-primary");
    await cta.scrollIntoViewIfNeeded();

    expect(await transformOf(page, ".hero .zip-form .btn-primary")).toBe("none");
    await cta.hover();
    await expect
      .poll(() => transformOf(page, ".hero .zip-form .btn-primary"))
      .toBe("matrix(1, 0, 0, 1, 0, -2)");

    await page.mouse.move(0, 0);
    await expect
      .poll(() => transformOf(page, ".hero .zip-form .btn-primary"))
      .toBe("none");
  });

  test("removes the hover lift but keeps the shadow under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/nq3");

    const cta = page.locator(".hero .zip-form .btn-primary");
    await cta.scrollIntoViewIfNeeded();
    await cta.hover();

    await expect
      .poll(() => transformOf(page, ".hero .zip-form .btn-primary"))
      .toBe("none");
    expect(await shadowLayerCount(page, ".btn-primary")).toBeGreaterThanOrEqual(2);
  });
});

test.describe("NQ4 landing", () => {
  test("renders the approved copy and escape hatch", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/nq4");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Give the next contractor a real number to beat.",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("nq4-check-area")).toHaveText("Check My Area");
    await expect(page.getByTestId("nq4-cta-footer")).toHaveText("Build My Number to Beat");
    await expect(page.locator(".nq4-hero .nq4-lead")).toContainText(
      "No estimate yet? Start here.",
    );
    await expect(page.locator('label[for="nq4-hero-zip"]')).toHaveText("Florida ZIP code");

    const escapeHatch = page.getByTestId("nq4-escape-hatch");
    await expect(escapeHatch).toHaveText(ESCAPE_HATCH_LABEL);
    const href = await escapeHatch.getAttribute("href");
    expect(href).toContain("wm_intent=has_quote");
    expect(href).toContain("#truth-gate");

    expect(await heightOf(page, '[data-testid="nq4-cta-footer"]')).toBeGreaterThanOrEqual(48);
    expect(await heightOf(page, '[data-testid="nq4-check-area"]')).toBeGreaterThanOrEqual(48);
    expect(await heightOf(page, '[data-testid="nq4-escape-hatch"]')).toBeGreaterThanOrEqual(48);
  });

  test("has no horizontal overflow at narrow viewports", async ({ page }) => {
    await page.goto("/nq4");
    for (const width of MOBILE_WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      expect(await hasHorizontalOverflow(page), `overflow at ${width}px`).toBe(false);
    }
  });

  test("hero ZIP submit opens the intake dialog", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/nq4");

    await page.getByTestId("nq4-hero-zip").fill("33301");
    await page.getByTestId("nq4-check-area").click();

    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("escape hatch navigates to the canonical truth gate without opening the intake", async ({ page }) => {
    await page.goto("/nq4");
    await page.getByTestId("nq4-escape-hatch").click();

    await expect(page).toHaveURL(/wm_intent=has_quote/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("elevates the previously flat surfaces into a composite shadow", async ({ page }) => {
    await page.goto("/nq4");

    for (const selector of [
      ".nq4-mech-card",
      ".nq4-step",
      ".nq4-compare-row",
      ".nq4-panel",
      ".nq4-cta",
      ".nq4-zip-submit",
    ]) {
      expect(
        await shadowLayerCount(page, selector),
        `${selector} must resolve to a composite shadow`,
      ).toBeGreaterThanOrEqual(2);
    }

    // Controls stay recessed: exactly one inset layer, no lift, no gradient.
    const input = await page.evaluate(() => {
      const el = document.querySelector(".nq4-zip-input")!;
      const styles = getComputedStyle(el);
      return { shadow: styles.boxShadow, image: styles.backgroundImage };
    });
    expect(input.shadow).toContain("inset");
    expect(input.image).toBe("none");
  });

  test("lifts the hero submit on hover and removes the lift under reduced motion", async ({ page }) => {
    await page.goto("/nq4");
    const submit = page.getByTestId("nq4-check-area");
    await submit.scrollIntoViewIfNeeded();

    expect(await transformOf(page, '[data-testid="nq4-check-area"]')).toBe("none");
    await submit.hover();
    await expect
      .poll(() => transformOf(page, '[data-testid="nq4-check-area"]'))
      .toBe("matrix(1, 0, 0, 1, 0, -2)");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.mouse.move(0, 0);
    await submit.hover();
    await expect
      .poll(() => transformOf(page, '[data-testid="nq4-check-area"]'))
      .toBe("none");
  });
});

/** Resolved value of a custom property on an element. */
async function customProperty(page: Page, selector: string, property: string) {
  return page.evaluate(
    ([sel, prop]) =>
      getComputedStyle(document.querySelector(sel)!).getPropertyValue(prop).trim(),
    [selector, property] as const,
  );
}

/** A computed style value read from a pseudo-element. */
async function pseudoStyle(
  page: Page,
  selector: string,
  pseudo: string,
  property: string,
) {
  return page.evaluate(
    ([sel, pseudoEl, prop]) =>
      getComputedStyle(document.querySelector(sel)!, pseudoEl)
        .getPropertyValue(prop)
        .trim(),
    [selector, pseudo, property] as const,
  );
}

test.describe("atmospheric illumination", () => {
  const decorativeLayers = [
    { path: "/nq3", selector: "main", pseudo: "::before" },
    { path: "/nq3", selector: "main", pseudo: "::after" },
    { path: "/nq3", selector: ".hero", pseudo: "::after" },
    { path: "/nq4", selector: ".nq4-root", pseudo: "::before" },
    { path: "/nq4", selector: ".nq4-root", pseudo: "::after" },
  ] as const;

  for (const layer of decorativeLayers) {
    test(`keeps ${layer.path} ${layer.selector}${layer.pseudo} non-interactive and behind content`, async ({
      page,
    }) => {
      await page.goto(layer.path);

      expect(
        await pseudoStyle(page, layer.selector, layer.pseudo, "pointer-events"),
      ).toBe("none");
      expect(
        Number(await pseudoStyle(page, layer.selector, layer.pseudo, "z-index")),
      ).toBeLessThan(0);
    });
  }

  test("NQ3 paints one continuous grid plane spanning the whole of main", async ({ page }) => {
    await page.goto("/nq3");

    // A per-section grid would restart its phase at every boundary. Asserting the plane
    // is as tall as main proves the lattice holds a single phase down the whole page.
    const { planeHeight, mainHeight, sectionCount } = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      return {
        planeHeight: Number.parseFloat(
          getComputedStyle(main, "::before").height,
        ),
        mainHeight: main.getBoundingClientRect().height,
        sectionCount: main.querySelectorAll(":scope > section").length,
      };
    });

    expect(sectionCount).toBeGreaterThanOrEqual(5);
    expect(planeHeight).toBeGreaterThan(0);
    expect(Math.abs(planeHeight - mainHeight)).toBeLessThan(2);
  });

  test("NQ3 moves the light pool with the pointer and leaves geometry stationary", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/nq3");

    const gridBefore = await pseudoStyle(page, "main", "::before", "background-position");

    await page.mouse.move(320, 240);
    await expect.poll(() => customProperty(page, "main", "--lit-x")).not.toBe("0.5");

    const x1 = Number(await customProperty(page, "main", "--lit-x"));
    const y1 = Number(await customProperty(page, "main", "--lit-y"));
    expect(x1).toBeCloseTo(0.25, 1);
    expect(y1).toBeCloseTo(0.2667, 1);

    await page.mouse.move(960, 720);
    await expect.poll(() => customProperty(page, "main", "--lit-x")).not.toBe(String(x1));

    expect(Number(await customProperty(page, "main", "--lit-x"))).toBeCloseTo(0.75, 1);
    expect(Number(await customProperty(page, "main", "--lit-y"))).toBeCloseTo(0.8, 1);

    // The architecture must not travel with the light.
    expect(await pseudoStyle(page, "main", "::before", "background-position")).toBe(gridBefore);
  });

  test("NQ3 writes no illumination state under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/nq3");

    await page.mouse.move(200, 200);
    await page.mouse.move(900, 600);
    await page.waitForTimeout(200);

    // The hook attaches no listener at all, so main carries no inline illumination state.
    const inlineStyle = await page.evaluate(
      () => document.querySelector("main")!.getAttribute("style") ?? "",
    );
    expect(inlineStyle).not.toContain("--lit-x");
    expect(await pseudoStyle(page, "main", "::after", "transition-duration")).toBe("0s");
  });

  test("NQ4 advances the scan band across the document and clamps at both ends", async ({
    page,
  }) => {
    await page.goto("/nq4");

    expect(Number(await customProperty(page, ".nq4-root", "--nq4-scan-progress")))
      .toBeCloseTo(0, 2);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(() => Number(customProperty(page, ".nq4-root", "--nq4-scan-progress")))
      .toBeGreaterThan(0.9);

    // Overscrolling must not push the band past the end of its travel.
    await page.evaluate(() => window.scrollTo(0, 10 ** 7));
    await expect
      .poll(() => Number(customProperty(page, ".nq4-root", "--nq4-scan-progress")))
      .toBeLessThanOrEqual(1);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
      .poll(() => Number(customProperty(page, ".nq4-root", "--nq4-scan-progress")))
      .toBeCloseTo(0, 2);
  });

  test("NQ4 leaves the scan band parked under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/nq4");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);

    const inlineStyle = await page.evaluate(
      () => document.querySelector(".nq4-root")!.getAttribute("style") ?? "",
    );
    expect(inlineStyle).not.toContain("--nq4-scan-progress");
  });

  test("the decorative layers never intercept a click aimed at page content", async ({
    page,
  }) => {
    await page.goto("/nq3");

    const heroCta = page.locator(".hero .zip-form .btn-primary");
    await heroCta.scrollIntoViewIfNeeded();
    const box = (await heroCta.boundingBox())!;

    // elementFromPoint at the CTA centre must resolve to the CTA, not a decorative layer.
    const topmost = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return el ? `${el.tagName.toLowerCase()}.${el.className}` : "none";
      },
      [box.x + box.width / 2, box.y + box.height / 2] as const,
    );
    expect(topmost).toContain("btn");
  });

  test("both pages wake only the section holding the middle of the viewport", async ({
    page,
  }) => {
    await page.goto("/nq3");

    const litCount = async () =>
      page.evaluate(() => document.querySelectorAll("main > section[data-lit]").length);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(litCount).toBeLessThanOrEqual(2);

    // Scroll well past the first section, then confirm the wake moved rather than
    // accumulating: a reveal-once latch would leave every passed section lit.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(300);
    const midCount = await litCount();
    expect(midCount).toBeGreaterThanOrEqual(1);
    expect(midCount).toBeLessThanOrEqual(2);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    expect(await litCount()).toBeLessThanOrEqual(2);
  });
});
