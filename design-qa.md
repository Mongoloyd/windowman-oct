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

## Admin Lead Inbox + Verdict Dossier reconciliation (2026-09-04)

- Approved Lead Inbox reference: `C:\Users\Dell\Desktop\Screenshots\the lead inbox went back to white.png` (1643 × 1183).
- Regressed dossier reference: `C:\Users\Dell\Desktop\Screenshots\Screenshot 2026-09-04 084150.png`.
- Implementation routes: `http://localhost:8080/admin/leads` and `http://localhost:8080/admin/pipeline?lead_id=e2015d37-2f99-4129-9ddd-a103a13d63ae`.
- Tested state: six live local lead projections, the Peter dossier, no active filters, and no data mutation.

### Source-to-implementation comparison

The approved Inbox reference and the implementation were inspected together at the same 1643 × 1183 desktop viewport. The implementation restores the selected structure: a dedicated command rail, compact row directory, bright lead identity, semantic state badges, latest-activity and follow-up columns, five-step pipeline projection, and a four-action control stack. Real local lead values intentionally replace the reference's illustrative names, counts, deadlines, and stages.

The recovered dossier was verified against the previously approved `4988c42b` presentation source. `LeadDossierSheet.tsx` and `LeadIdentity.tsx` exactly match that source blob. The live sheet again renders the Confidential Lead Verdict File cover, high-contrast dollar/flag/confidence strip, limited-evidence notice, layered contact and contractor panels, and semantic red/amber/green/blue evidence treatments.

### Fidelity and behavior

- Visual hierarchy: passed. Near-white identity and operational facts lead; steel metadata recedes; cobalt, teal, ember, and red have distinct state jobs.
- Density: passed. Desktop rows expose identity, status, activity, follow-up, workflow progress, and actions in one scan without the prior stacked-card whitespace.
- Surface separation: passed. Canvas, rail, directory, alternating rows, fact columns, action column, drawers, and dossier panels use distinct dark values and hairlines.
- Controls: passed. Badges use firm edges, primary actions remain cobalt, and all interactive controls retain 44-pixel minimum targets.
- Responsive behavior: passed at 390 × 844, 1024 × 900, 1440 × 1024, and 1643 × 1183. No document-level horizontal overflow was present.
- Interactions: passed. Search narrowed the six-lead queue to four Peter records; context and workflow drawers opened independently and remained readable when both were open.
- Data boundaries: passed. No lead query, persistence, Supabase, phone, CRM, OTP, scanner, routing, or tracking implementation changed.
- Automated verification: 20 focused Inbox/Dossier tests passed; TypeScript typecheck passed; production build passed; diff whitespace check passed.
- Baseline lint note: the dossier file retains the same ten pre-existing `no-explicit-any` findings present in the untouched base version; this restoration adds no new lint category or count.

### Findings

No actionable P0, P1, or P2 visual or interaction findings remain.

final result: passed

## Admin Lead Inbox — Operator Story Arc overhaul (2026-09-04)

- Selected visual source: `C:\Users\Dell\.codex\generated_images\01a06a3e-7385-7681-9317-217a5a08562c\exec-6b0f1e51-b703-4869-9869-db08b9a974b7.png` (1440 × 1024).
- Art-direction reference: `C:\Users\Dell\Downloads\light story arc.png`.
- Implementation route: `http://localhost:8080/admin/leads`.
- Desktop implementation capture: live in-app-browser QA capture at 1440 × 1024 CSS pixels, device density 1; local QA artifact, not committed.
- Mobile implementation capture: live in-app-browser QA capture at 390 × 844 CSS pixels, device density 1; local QA artifact, not committed.
- Tested state: six live local lead projections, no active filters, all operational actions preserved.
- Density normalization: the selected mock and desktop implementation were inspected at the same 1440 × 1024 viewport and 1× density.

### Source-to-implementation comparison

The selected mock and implementation were compared at equal viewport size. The implementation preserves the approved hierarchy: canonical WindowMan wordmark, dark horizontal operator navigation, compact command rail, lead-count briefing, refresh action, and a dense lead directory. It intentionally uses the real local lead data and the existing application icon family rather than copying illustrative mock values or manufacturing data.

The visual system follows the user's “light has a job” direction without importing homeowner-report drama into the operator console:

- cobalt marks primary navigation and the Open lead action;
- teal marks verified and resolved states;
- ember marks contacted or attention states;
- red is reserved for urgent risk;
- steel-grey supports neutral information;
- near-white carries identity, titles, lead metadata, and operational facts.

No grade, gauge, glow, promotional orange button, or cyberpunk treatment was introduced.

### Focused-region comparison evidence

The header, first three lead records, status badges, identity metadata, and command controls were readable in the equal-size desktop comparison. Focused inspection confirmed:

- the top-left mark is the existing homepage `BrandLogo`, not a recreated wordmark or substitute asset;
- email, phone, lead ID, section titles, and fact values use brighter near-white/steel colors;
- New, Booked, Contacted, and Phone Verified use firm hairlines and small radii rather than soft pills;
- the canvas, command rail, directory, alternating rows, controls, and dividers use visibly different dark surfaces;
- the primary blue button remains the strongest actionable control;
- disabled Clear all remains a dark control and cannot produce a white slab.

### Required fidelity surfaces

- Fonts and typography: passed. The existing WindowMan display/body typography remains intact, while uppercase operational labels and tabular values preserve scanning rhythm.
- Spacing and layout: passed. Desktop uses a compact two-column command-and-directory structure. Lead identity, operational facts, context, and workflow remain grouped without the former full-width white-card gaps.
- Colors and tokens: passed. Solid graphite, navy, slate, cobalt, teal, ember, red, and steel surfaces create intentional contrast without gradients or glow.
- Logo and icons: passed. The canonical homepage logo component and the existing Lucide icon family are reused.
- Copy and live content: passed. Existing names, contact facts, stages, activity, follow-up state, actions, and filter behavior remain wired to the current data path.
- Accessibility and behavior: passed. Controls retain visible focus treatment, status meaning is carried by text as well as color, primary mobile targets remain at least 44 pixels, and the mobile page has no document-level horizontal overflow.
- Responsive behavior: passed. At 390 × 844 the command rail stacks above the directory, the admin navigation remains horizontally scrollable, the sign-out action remains reachable, and lead content stays within the page width.
- Runtime: passed. Search-to-empty-state and Clear all restoration were exercised in the live browser. The final browser console contained no application errors.

### Comparison history

1. Initial desktop implementation used correct color intent but lead cards consumed too much vertical space. The records were compacted into an identity/facts row with a separate context/workflow row.
2. Initial mobile header retained the full role treatment and crowded the available width. The opt-in inbox header now preserves the canonical logo and reachable sign-out action while hiding nonessential identity decoration at phone width.
3. Browser QA exposed a disabled Clear all control inheriting a bright component surface. The inbox-scoped disabled treatment now uses a dark control background and explicit steel text.
4. Final desktop and mobile inspection found no actionable P0, P1, or P2 visual differences from the approved direction.

### Scope evidence

- Presentation changes are confined to the Lead Inbox page, opt-in admin-shell/navigation variants, scoped CSS, and directly related tests.
- No Supabase query, persistence service, schema, Edge Function, phone/CRM/OTP/scanner path, tracking path, or contractor-routing logic changed.
- Existing loading, error, empty, filtering, copy, quote, pipeline, lead-open, and workflow-edit behavior remains present.

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
