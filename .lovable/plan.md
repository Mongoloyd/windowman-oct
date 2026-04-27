Plan:

1. Update `src/pages/diagnosis/components/StepIntake.tsx`
  - Replace the current navy container layout with the provided centered vertical stack.
  - Remove the existing `h-full`, `min-h-[240px]`, `justify-between`, and bottom-push behavior.
  - Use `flex flex-col items-center text-center` so the icon, headline, subheadline, and image stage stack naturally.
2. Add the WindowMan hand-to-chest image back into the navy card
  - Render the figure immediately under the headline/subheadline.
  - Use the provided image path `/images/windowman-hand-to-chest.avif` if the asset already exists in `public/images/`.
  - If it does not exist, add/copy the uploaded hand-to-chest AVIF asset to the expected project location.
3. Implement the square hero image stage
  - Use `relative mx-auto aspect-square w-full max-w-[500px]` so the stage targets 500×500px on desktop.
  - Preserve the 1:1 aspect ratio on mobile while allowing the navy card to expand vertically.
  - Keep the image always visible on all breakpoints.
4. Apply high-impact figure styling
  - Use `object-contain object-center`loading="eager" on the image.
  - Use `loading="eager"` so the hero figure appears immediately.
  - Keep the stage centered with consistent padding and breathing room.
5. Validate
  - Run TypeScript validation after implementation.
  - If needed, make small responsive class adjustments to avoid clipping while preserving the requested active hero look.