## Plan

### 1. Fix the case-file preview visual bug (root cause identified)
`src/assets/wm-receipt-bg.png` is not a texture — it's a fully-rendered fake calendar booking widget ("Book a free measurement", date strip 13–19, 9:00 AM/11:30 AM/2:00 PM/4:30 PM time pills, Confirm time / View availability buttons). The dark gradient overlay in `PreUploadIntake.tsx` is too transparent, so the baked-in UI bleeds through behind the real ReceiptLines (PATH / HOME / ASSIGNED / JURISDICTION). That's the artifact in the screenshot with the green X.

- Regenerate `src/assets/wm-receipt-bg.png` via `imagegen--generate_image` as a **pure texture only**: dark navy paper grain with subtle blueprint grid linework, no text, no UI, no buttons, no dates, no icons. Aspect 3:2, premium quality not needed.
- Verify the receipt panel in `PreUploadIntake.tsx` (lines 488–525) renders cleanly with only the dot-leader rows visible.

### 2. Generate the down-pointing tall WindowMan (Option 2)
- Source: `user-uploads://Window_Man_with_sunglasses_on...handshake.png`.
- Use `imagegen--edit_image` with prompt: full-body standing pose, feet planted, deliberate monumental scale, sunglasses on, blue/white WM uniform unchanged from source, **right arm lowered with index finger pointing down at ~45° toward the lower-left**, slight three-quarter turn toward viewer, transparent background, soft amber rim-light from the right.
- Aspect ratio: `9:16`.
- Save to `src/assets/wm-pointing-tall.png`.

### 3. Swap the asset and reposition in `PreUploadIntake.tsx`
- Replace `wm-pointing.png` import with `wm-pointing-tall.png`.
- Right-rail wrapper: `hidden md:block absolute right-0 bottom-0 h-[95vh] w-auto object-contain object-bottom pointer-events-none z-0`.
- Confirm finger lands near the first input in Zone B (Name field) at the 1509px viewport.
- Form controls remain on `z-10` so they stay clickable above him.

### 4. QA
- Screenshot `/sandbox/intake` after both changes.
- Zoom into the case-file preview band → confirm no calendar widget bleeding through.
- Confirm WindowMan: no body cutoff, head near top, crotch near baseline, finger directional toward inputs.

### Constraints
- Visual-only. No `App.tsx`, routing, state, or backend changes.
- No new routes.