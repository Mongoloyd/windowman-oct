My opinion: yes, I agree with your instinct. On a 390px mobile viewport, this verdict panel is doing too much vertically. The top icon and bottom audit subtext are low-conversion decoration at this moment. The user has already watched the scanner; once the verdict appears, the job is to get them to choose one of two actions quickly.

I would not remove the risk cards or the verdict copy. Those are the persuasion payload. I would remove/reduce the parts that do not help the decision.

Recommended direction

1. Remove the top verdict icon for all three versions
   - Critical: remove red alert octagon from the verdict modal.
   - Caution: remove amber alert icon.
   - Verified: remove green check icon.
   - Keep the color-coded headline and risk cards so the state is still clear.

2. Remove the bottom audit/compliance subtext for all three versions
   - Remove: `AI Audit ID: ... // v4.2 Compliance Engine`.
   - This line feels technical/demo-like and costs vertical space without helping the user act.

3. Tighten mobile spacing inside the panel
   - Reduce mobile padding from `p-4` to a more compact vertical layout, while keeping desktop close to current.
   - Reduce the summary/risk/CTA margins on mobile.
   - Keep desktop spacing more generous via existing `md:` classes.

4. Keep the decision prompt unless you want maximum compression
   - My recommendation: keep `This was a demo estimate. Choose your next step.` for now, but make it smaller/tighter.
   - Reason: it explains why the demo verdict is asking for a real next step.
   - If we need an even shorter version after previewing, remove this line too. But I would first delete the top icon and audit footer because those are the clearest dead weight.

Exact file scope

Only change:
- `src/components/OrangeScanner.tsx`

Exact UI placement affected

Inside `VerdictHologram`:
- Remove the top icon block above the `VERDICT:` headline.
- Remove the bottom audit ID block below the two CTA buttons.
- Adjust spacing around:
  - verdict headline
  - summary paragraph
  - risk cards list
  - decision gate section
  - CTA buttons

What I would not touch

- No route changes.
- No backend changes.
- No scanner logic changes.
- No Supabase changes.
- No upload/OTP/report gating changes.
- No copy changes to the three verdict scenarios unless you ask for that separately.
- No change to the actual CTA destinations/actions.

Why this is safe

This is a presentational compression of the existing `OrangeScanner` verdict overlay. It does not affect acquisition routing, quote scanning, verification, report access, private storage, deterministic scoring, or any backend security boundary.

Implementation plan after approval

1. Edit `src/components/OrangeScanner.tsx` only.
2. In `VerdictHologram`, remove the rendered icon container and the unused `VerdictIcon` assignment if it becomes unnecessary.
3. Remove the bottom audit ID JSX block.
4. Tighten mobile Tailwind classes while preserving desktop readability:
   - smaller mobile panel padding
   - smaller mobile margins
   - slightly tighter risk-card padding/gaps
   - keep buttons large enough to tap comfortably
5. Verify visually at the current mobile viewport that the full verdict panel no longer traps the user and the two CTAs are visible sooner.

Approval prompt

Approve this plan if you want me to implement the shorter mobile verdict panel in `src/components/OrangeScanner.tsx` only.