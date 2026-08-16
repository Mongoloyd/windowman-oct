# `/wmchat` Nationwide Trust Layer — Design QA

- Source visual truth: `C:\Users\Dell\Downloads\wmchat hero CRO stuff.PNG`
- Supplied styling reference: `C:\Users\Dell\Downloads\impact window css.css`
- Motion reference: `C:\Users\Dell\Screen REcordings\Recording 2026-08-16 032016.mp4`
- Implementation route: `http://127.0.0.1:5174/wmchat`
- Full comparison: `C:\Users\Dell\AppData\Local\Temp\wmchat-design-qa\comparison-1107x911.jpg`
- Focused trust-card comparison: `C:\Users\Dell\AppData\Local\Temp\wmchat-design-qa\comparison-trust-cards.jpg`
- Final mobile capture: `C:\Users\Dell\AppData\Local\Temp\wmchat-design-qa\implementation-final-375.jpg`
- Refined header/mobile capture: `C:\Users\Dell\AppData\Local\Temp\wmchat-design-qa\implementation-header-refined-375.png`
- Viewport comparison: source and implementation normalized to 1107 × 911 pixels at device scale 1
- Responsive checks: 375 × 812, 472 × 900, and 1107 × 911
- State: direct cold entry before the first conversation choice

## Full-view comparison

The implementation preserves the selected dark architectural grid, spotlighted WindowMan hero, narrow centered conversation stage, and existing image asset. It intentionally replaces the source's placeholder labels, Florida-specific trust card, and speech control with the approved nationwide header and evidence hierarchy.

The three-card rail measures 348px at the 375px viewport while the active WindowMan bubble measures 298px. At 472px, the rail measures 446px and the bubble 388px. This produces the requested wider proof hierarchy without horizontal overflow.

## Focused-region comparison

The supplied impact-window CSS informed the metallic outer rail, inset glass, reflection, and depth. The implementation makes the functional glass surface opaque, removes the reference's infinite shine, uses amber/emerald/cyan semantics, and adds a bounded tap/keyboard flip. The focused comparison confirms the new cards are more visually prominent and less monotonous than the source trust strip.

## Required fidelity surfaces

- Fonts and typography: passed. Existing app typography is preserved; card titles were increased after the first mobile capture for 50+ readability.
- Spacing and layout rhythm: passed. Cards extend beyond the chat column, remain symmetrical with the hero cone, and introduce no horizontal overflow at 375px or 472px.
- Colors and tokens: passed. Opaque navy surfaces block the page grid; amber, emerald, and cyan accents carry distinct meanings without becoming promotional CTA colors.
- Image quality and asset fidelity: passed. The approved WindowMan raster remains uncropped, sharp, and unchanged.
- Copy and content: passed. First-glance copy is nationwide, avoids savings/safety guarantees, and retains stable internal intake IDs.

## Interaction and accessibility evidence

- One card opens at a time.
- Tap and Enter both toggle the flip state.
- Each card exposes `aria-expanded` and a state-specific accessible name.
- Reduced-motion CSS disables entrance, flip transition, lift, and sheen.
- Initial option buttons remain at least 56px high at 375px.
- Selecting the first chat choice removes the proof rail, preserves the hero, and advances the existing state machine.
- Browser console showed no application errors; only pre-existing React Router future-flag warnings appeared.

## Comparison history

1. Initial mobile capture: `implementation-375.jpg`
   - P2: front/back trust-card copy was too small for the 50+ target.
   - Fix: raised minimum front title, back detail, eyebrow, and action sizes; preserved the fixed square footprint.
   - Compatibility fix: replaced `color-mix()` shadows with explicit tone variables.
2. Post-fix capture: `implementation-final-375.jpg`
   - The cards remain compact, readable, and fully visible at 375px with no horizontal overflow.
3. Header and mobile-legibility refinement:
   - Removed the bordered header panel so the brand, centered promise, and split status signals sit directly on the page canvas.
   - Locked the trust rail to native operating-system fonts with antialiasing and restrained text shadows for narrow-screen clarity.
   - Confirmed the header computes to a transparent background, zero border, and no box shadow; the cards show no text overflow at 375px, 472px, or desktop widths.

## Evidence limits

The motion recording could not be frame-extracted in the local toolchain. Motion was verified from the supplied CSS contract and the live interactive implementation rather than as a frame-for-frame video comparison. This does not block the approved bounded flip behavior.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

- P3: after real-device testing, the metallic border brightness can be tuned ±5% without changing layout or interaction.

final result: passed
