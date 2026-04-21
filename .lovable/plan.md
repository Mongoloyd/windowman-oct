

## FOUC / App Shell Paint Fix

Inject critical inline CSS at the very top of `<head>` in `index.html` so the first paint already matches the WindowMan light shell — eliminating the white/Times-flash before React + Tailwind hydrate.

### Change scope
**One file only:** `index.html`

### What changes

1. Move a critical inline `<style>` block to be the **first child of `<head>`** (before GTM, before any other tag). Browsers apply this synchronously on the very first paint.
2. Replace the existing late-in-head `<style>` (lines 90-93) with a stronger, exact-match version that sets:
   - `html, body` background → `hsl(214 35% 95%)` (the canonical `--background` token from `src/index.css`, light blue-white shell — matches the live app exactly, replacing the slightly-off `#EEF2F8`)
   - `html, body` text color → `hsl(210 45% 11%)` (canonical `--foreground` token)
   - `html, body` font-family → native system stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (matches `--wm-font-body`)
   - `html, body, #root` `min-height: 100%`
   - `body { margin: 0 }`
3. Update `<meta name="theme-color">` from `#EEF2F8` → `#EBF0F6` (the actual hex of `hsl(214 35% 95%)`) so the mobile chrome bar matches the shell.

### What does NOT change
- No `class="dark"` added anywhere
- No new components, no loading screen, no JS
- Tailwind tokens, theme, routes, GTM script, OTP/Twilio/scanner flow — all untouched
- `src/index.css`, `tailwind.config.ts`, all React code — untouched

### Final inline CSS block (placed as first child of `<head>`)
```html
<style>
  html, body, #root { min-height: 100%; }
  html, body {
    margin: 0;
    background: hsl(214 35% 95%);
    color: hsl(210 45% 11%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
</style>
```

### Result
First browser paint = correct WindowMan light shell color, native system font already applied, full-height layout. No white flash. No Times Roman flash. No dark flash. Diff is ~10 lines in one file.

