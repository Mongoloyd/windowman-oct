export const PROPHECY_CANVAS_COLOR = "#070e18";
export const DEFAULT_PUBLIC_THEME_COLOR = "#EBF0F6";
export const PROPHECY_THEME_ATTRIBUTE = "data-wm-theme";
export const PROPHECY_THEME_VALUE = "prophecy";

export function isProphecyPath(pathname: string): boolean {
  return pathname === "/prophecy" || pathname === "/prophecy/";
}

/**
 * Keeps browser chrome and the document canvas dark for the lifetime of the
 * Prophecy route. The base document owns the light fallback and exposes it via
 * data-default-content so leaving the route cannot leak the dark theme.
 */
export function activateProphecyDocumentTheme(
  targetDocument: Document = document,
): () => void {
  const root = targetDocument.documentElement;
  const themeColor = targetDocument.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  root.setAttribute(PROPHECY_THEME_ATTRIBUTE, PROPHECY_THEME_VALUE);
  themeColor?.setAttribute("content", PROPHECY_CANVAS_COLOR);

  return () => {
    root.removeAttribute(PROPHECY_THEME_ATTRIBUTE);
    themeColor?.setAttribute(
      "content",
      themeColor.dataset.defaultContent || DEFAULT_PUBLIC_THEME_COLOR,
    );
  };
}
