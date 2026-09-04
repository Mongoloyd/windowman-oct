# Partial Reveal Evidence Summary — Design QA

- Source visual truth: local QA artifact; not committed.
- Implementation route: `http://localhost:8080/dev/report-preview?v=v3&mode=preview`
- Desktop implementation capture: local QA artifact; not committed.
- Mobile viewport capture: local QA artifact; not committed.
- Mobile full-page capture: local QA artifact; not committed.
- State: DEV preview fixture, safe pre-verification projection, no full-report authorization
- Source pixels: 852 × 1847
- Desktop capture: 852 × 1162 pixels from an 852 × 1200 CSS viewport override, device density 1
- Mobile capture: 390 × 845 pixels from a 390 × 844 CSS viewport override, device density 1
- Mobile full-page capture: 390 × 3404 pixels
- Density normalization: source and desktop implementation were compared at the same 852-pixel width and 1× density; no resampling was required

## Full-view comparison evidence

The selected source visual and the desktop implementation capture were opened together in one comparison input. The implementation preserves the selected hierarchy: forensic eyebrow, preview heading, explanatory copy, bordered Evidence Summary, dominant document-specific statement, three safe proof-of-read facts, locked-detail line, objective disclaimer, and the existing aggregate metric rail.

The source is a taller 852 × 1847 component mock while the implementation capture is the 852 × 1162 browser viewport. The common hero region was compared at equal width and density. The implementation intentionally keeps the current application shell, red readiness tint, locked case-file panel, and existing aggregate metric semantics.

Dynamic fixture values intentionally differ from the art-direction mock:
- source: Coastal Fortress, 12 review items, 10 openings, 3 pages, 24 line items
- implementation: BrightView Window, 18 review items, 14 openings, 1 page, 3 line items

The implementation also preserves the existing `9 / Locked / 9` aggregate metric contract instead of adopting the mock's illustrative `4 / 1 / 1` values.

## Focused-region comparison evidence

A separate crop was not required because the Evidence Summary text, icons, separators, disclaimer, and metric cards are readable in both 852-pixel-wide images. The focused comparison confirms:

- the shield-check and evidence facts use the existing Lucide icon family;
- the main statement carries the strongest visual weight;
- the review count is highlighted in emerald without becoming a CTA;
- the three facts are separated cleanly and remain non-interactive;
- the lock line is visibly subordinate;
- the implementation uses existing WindowMan typography and forensic surface tokens rather than introducing a second design system.

## Required fidelity surfaces

- Fonts and typography: passed. Existing WindowMan display and body faces are preserved. The heading, evidence statement, monospaced eyebrow, fact counts, and support copy retain the source hierarchy without cramped desktop wrapping.
- Spacing and layout rhythm: passed. The evidence panel uses a compact internal rhythm and does not recreate the tall pillar-card roadblock. At 390px, its measured width is 308.84px with `scrollWidth === clientWidth === 307`; no horizontal overflow occurs.
- Colors and tokens: passed. The panel uses the selected emerald proof color, slate dividers, dark forensic glass, and the existing readiness-tinted hero. No orange promotional CTA treatment was introduced.
- Image quality and asset fidelity: passed. The target uses icons rather than raster imagery; the implementation uses the existing Lucide vector family and the existing WindowMan mark with no placeholder or handcrafted SVG substitute.
- Copy and content: passed. The implementation renders only safe proof-of-read facts and aggregate review count, correctly pluralizes “1 page read,” and keeps specific findings locked.
- Icons: passed. Shield, document-search, page, list, and lock icons are visually consistent and aligned with their labels.
- Responsiveness: passed. Desktop and 390px mobile captures preserve hierarchy, readable wrapping, and containment. The three fact cells remain visible without clipping.
- Accessibility and behavior: passed. The summary is labeled, facts have a labeled grouping, decorative icons are hidden from assistive technology, and the static panel has no button, link, hover, or false-click affordance.
- Runtime: passed. A clean in-app-browser tab rendered the Evidence Summary with zero console errors.

## Security and data-boundary evidence

- No pillar numeric scores or protected findings are rendered.
- Missing contractor, page, opening, or line-item values collapse rather than displaying “Unknown,” `NaN`, or fabricated zeroes.
- Hostile sentinels for `full_json`, raw line items, exact total, and phone remain absent from rendered output in the focused test suite.
- No Supabase function, migration, analysis hook, or report service changed.

## Comparison history

1. Initial implementation verification:
   - Type-level review found the one-page fixture needed a singular label.
   - Fix: fact labels now pluralize from the sanitized count, producing “1 page read.”
2. Desktop visual comparison:
   - No actionable P0, P1, or P2 differences remained.
   - Intentional differences were classified as dynamic fixture content and preservation of the existing aggregate metric contract.
3. Mobile visual comparison:
   - No overflow or broken wrapping was found.
   - Evidence panel measured 308.84px wide inside the mobile hero with equal client and scroll widths.
4. Clean-runtime verification:
   - A fresh in-app-browser tab rendered the selected state with zero console errors.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

- P3: after testing with unusually long real contractor names, the statement's maximum two-to-three-line rhythm can be tuned if needed without changing the safe data contract.

## Partial reveal CRO polish verification (checkpoint `dc2232ab`)

- Reference: local QA artifact; not committed.
- Runtime: `http://localhost:8080/dev/report-preview?v=v3&mode=preview`.
- Desktop and 390px mobile review confirmed the intermediate hero CTA is removed while the blurred findings, central lock overlay, readiness review, and final verification gate remain intact.
- The evidence facts fail closed and use the approved `quoted line items parsed` label.
- The center metric is a neutral, non-interactive `Analysis Ready / Pricing & Scope Review` tile.
- The preview summary names the detected contractor without repeating the total or severity split.
- The preview Scope Overview contains only safe, available facts: openings detected and the mapped pricing category. The selected fixture correctly renders `Below Market` from its `low` band.
- The full-report branches remain covered by focused regression tests.
- Browser console review found no application errors; only existing React Router future-flag warnings were present.
- Focused forensic-report tests, typecheck, production build, diff checks, and protected-surface no-touch checks passed.
- Screenshots: local QA artifacts; not committed.

## Preview count derivation correction

- Reference: local QA artifact; not committed.
- Runtime: `http://localhost:8080/dev/report-preview?v=v3&mode=preview&scenario=typical`.
- Repo inspection confirmed the production evidence-summary total remains `flagRedCount + flagAmberCount`; the incorrect `2` was isolated to the DEV `typical` fixture's temporary `1 + 1` values.
- The corrected typical fixture renders 9 material concerns, 9 clarifications, and 18 total review items in both the Evidence Summary and the lower Quote Readiness Review.
- Singular states render `1 Material Quote Concern`, `1 Clarification Needed`, and `1 item`; zero states use honest non-numeric preview copy.
- The three blurred findings, central lock overlay, and verification presentation remain unchanged.
- The 609 × 771 mobile viewport has no horizontal overflow. Desktop comparison matches the requested 9 / Analysis Ready / 9 hierarchy and adds the combined total directly below it.
- Runtime console review found no application errors; only the existing React Router future-flag warnings remain.
- Screenshots: local QA artifacts; not committed.

final result: passed

## Truth Report selective Change-Order accordion rebuild (2026-09-03)

- Primary visual reference: local user-supplied QA artifact (1510 x 12434); not committed.
- Rejected-state references: four local user-supplied QA artifacts; not committed. These were used to confirm that major report sections must not become parent accordions.
- Implementation route: `http://127.0.0.1:8080/dev/report-preview?v=v3&mode=full&scenario=typical`.
- Tested state: full-report sanitized development fixture, with WindowMan report chrome intact and the development-only `SANDBOX PREVIEW` label visible.

## Source-to-implementation comparison

- Full-page comparison was performed at a 1510 CSS-pixel desktop width against the primary reference. The implementation document measured 1510 x 13836 because Financial Integrity and Questions to Get a Better Quote remain fully rendered, as required by the user's written direction. The reference image showed those areas collapsed; the written direction intentionally overrides that rejected part of the screenshot.
- The browser's stitched full-page capture visually repeated a few long-page regions. DOM inspection confirmed this was a capture artifact: every major `h2` heading, including Quote Math Ledger, Code & Compliance Proof, Change-Order Defense Matrix, Financial Integrity, Warranty & Fine Print, and Questions to Get a Better Quote, exists exactly once.
- Focused 1280 x 900 desktop captures confirmed the Change-Order header, summary chips, parsed-policy notice, and all risk rows retain the forensic visual hierarchy.
- Focused Financial Integrity and Better Quote Toolkit captures confirmed both sections remain visible and fully populated rather than being hidden behind section-level accordions.

## Interaction and state verification

- The Change-Order risk list uses independent multi-open items. Opening a non-red row does not close an already-open red row.
- All rows whose canonical severity is `fail` start expanded. The typical fixture expands Written Change Orders, Homeowner Approval Rule, Unilateral Price Adjustments, and Remeasure Price Cap.
- Non-fail rows start condensed, including Open-Wall / Substrate Clause, Hidden Condition Clause, and Change-Order Policy Text.
- Condensed rows preserve the item title, homeowner-facing summary, semantic status pill, and disclosure control. Expanded rows reveal parsed clause evidence, potential exposure, and the contractor question.
- The trigger is keyboard-operable through the existing Radix primitive and retains a minimum 44-pixel tap target.

## Required fidelity surfaces

- Fonts and typography: passed. Existing forensic display, body, and monospaced label styles are preserved.
- Spacing and layout rhythm: passed. Condensed rows reduce vertical density without removing report context; expanded critical rows retain readable evidence spacing.
- Colors and tokens: passed. Existing red, amber, blue, green, slate, and navy semantic treatments remain unchanged.
- Image quality and assets: passed. No new raster asset, placeholder, handcrafted SVG, or substituted icon was introduced.
- Copy and content: passed. Existing titles, summaries, evidence, exposure text, and contractor questions remain intact.
- Icons: passed. Existing Lucide alert and chevron icons are reused and rotate with disclosure state.
- Responsiveness: passed. At 390 x 844, the report had no horizontal overflow; a condensed non-red row remained readable and measured 139 pixels tall.
- Accessibility and behavior: passed. `aria-expanded` reflects each independent item, multiple items can remain open, and visible context is retained in every collapsed row.
- Runtime: passed. The clean page rendered without a Vite error overlay. The only console messages were pre-existing React Router future-flag warnings.

## Verification results

- Focused Change-Order and report-shell tests: 19/19 passed.
- Full forensic-report suite: 91/91 passed.
- Typecheck: passed.
- Exact-file lint: passed with zero errors and zero warnings.
- Production build: passed; only the existing Browserslist data-age notice was emitted.
- No backend, Supabase, OTP/reveal, scanner, tracking, deployment, or full-report authorization surface changed.

## Findings

No actionable P0, P1, or P2 findings remain.

final result: passed
