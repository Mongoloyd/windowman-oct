Plan: Footer “View Live Demo” Button Redesign

1. Update `src/components/StickyCTAFooter.tsx`
   - Locate the existing secondary `View Live Demo` button in the bottom CTA/footer area.
   - Wrap that button in a tight gradient-border container:
     - `bg-gradient-to-tr from-orange-400 to-blue-400`
     - `p-[2px]`
     - `rounded-xl`
     - `shadow-lg`
     - `hover:-translate-y-0.5`
   - Keep the button text as `View Live Demo`.

2. Preserve behavior exactly
   - Keep the existing `onDemoClick` handler.
   - Do not change routing, links, funnel state, tracking, backend code, Supabase code, or CTA logic.

3. Adapt sizing for the sticky footer layout
   - Use the requested visual structure, but size it to sit cleanly beside `Scan My Quote`.
   - If full `px-6 py-3` is too large in the footer row, use a compact equivalent such as `px-5 py-2.5 text-sm` while preserving the gradient-border treatment.
   - Ensure the button remains responsive in the existing mobile/desktop flex layout.

4. Validation
   - Run the TypeScript/build check after the edit.
   - Confirm the change is visual-only and the build ends green.