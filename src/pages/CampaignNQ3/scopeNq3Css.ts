const NQ3_PAGE_SELECTOR = '[data-page="campaign-nq3"]';
const NQ3_SHARED_UI_EXCLUSION =
  ":not(:where([data-campaign-shared-ui])):not(:where([data-campaign-shared-ui] *))";

function excludeSharedUi(selector: string): string {
  const pseudoElementIndex = selector.indexOf("::");
  if (pseudoElementIndex === -1) {
    return `${selector}${NQ3_SHARED_UI_EXCLUSION}`;
  }

  return `${selector.slice(0, pseudoElementIndex)}${NQ3_SHARED_UI_EXCLUSION}${selector.slice(
    pseudoElementIndex,
  )}`;
}

function scopeSelectorList(rawSelector: string): string {
  const leading = rawSelector.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)*)/)?.[0] ?? "";
  const selectorList = rawSelector.slice(leading.length);

  if (selectorList.trimStart().startsWith("@")) {
    return rawSelector;
  }

  const scoped = selectorList.split(",").map((selector) => {
    const trimmed = selector.trim();
    if (trimmed === ":root" || trimmed === "html" || trimmed === "body") {
      return excludeSharedUi(NQ3_PAGE_SELECTOR);
    }
    if (trimmed === "*") {
      return `${excludeSharedUi(NQ3_PAGE_SELECTOR)},${NQ3_PAGE_SELECTOR} ${excludeSharedUi("*")}`;
    }
    return `${NQ3_PAGE_SELECTOR} ${excludeSharedUi(trimmed)}`;
  }).join(",");

  return `${leading}${scoped}`;
}

/**
 * Comments are removed before scoping rather than carried through.
 *
 * The scoping pass treats everything before an opening brace as a selector, so a brace
 * inside a comment splits the comment in half: the first fragment is prefixed as though
 * it were a selector and the comment's closing brace terminates a rule that was never
 * opened. That silently corrupts every declaration after it — including the custom
 * property block, which takes the whole page's theming with it. Stripping comments first
 * makes the pass immune, so documentation in the stylesheet can describe CSS freely.
 *
 * Each comment becomes a single space, because a comment can legally separate two tokens.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

export function scopeNq3Css(css: string): string {
  return stripComments(css).replace(
    /([^{}]+)\{/g,
    (_match, selector: string) => `${scopeSelectorList(selector)}{`,
  );
}
