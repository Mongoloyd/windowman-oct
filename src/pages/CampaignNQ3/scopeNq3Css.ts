const NQ3_PAGE_SELECTOR = '[data-page="campaign-nq3"]';

function scopeSelectorList(rawSelector: string): string {
  const leading = rawSelector.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)*)/)?.[0] ?? "";
  const selectorList = rawSelector.slice(leading.length);

  if (selectorList.trimStart().startsWith("@")) {
    return rawSelector;
  }

  const scoped = selectorList.split(",").map((selector) => {
    const trimmed = selector.trim();
    if (trimmed === ":root" || trimmed === "html" || trimmed === "body") {
      return NQ3_PAGE_SELECTOR;
    }
    if (trimmed === "*") {
      return `${NQ3_PAGE_SELECTOR},${NQ3_PAGE_SELECTOR} *`;
    }
    return `${NQ3_PAGE_SELECTOR} ${trimmed}`;
  }).join(",");

  return `${leading}${scoped}`;
}

export function scopeNq3Css(css: string): string {
  return css.replace(
    /([^{}]+)\{/g,
    (_match, selector: string) => `${scopeSelectorList(selector)}{`,
  );
}
