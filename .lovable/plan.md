Revised plan: Admin Partners modal layout hardening + Enterprise SaaS polish

Scope
- This is a 100% UI/UX and layout hardening task.
- No Supabase write logic, Twilio OTP, AI scanner logic, protected route guards, RLS, report access, or backend authorization logic will be changed.

1. Harden the shared dialog shell

Update `src/components/ui/dialog.tsx` so `DialogContent` is viewport-safe by default:
- Use `w-[calc(100vw-2rem)] sm:max-w-xl` instead of a raw full-width modal that can touch or exceed the viewport.
- Add `box-border` so padding and borders are included in modal width calculations.
- Add `max-h-[calc(100vh-2rem)] overflow-y-auto` so tall modal content stays usable without clipping.
- Preserve the existing centering logic:
  - `fixed left-[50%] top-[50%]`
  - `translate-x-[-50%] translate-y-[-50%]`

Scrollbar polish:
- Add custom slim scrollbar styling to the dialog shell so vertical overflow looks intentional and modern.
- Prefer Tailwind utility classes if available, such as `scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent`.
- If the scrollbar utility plugin is not available, add a small reusable CSS class for WebKit/Firefox slim scrollbars and apply it to the dialog content.

2. Apply matching safety to alert dialogs

Update `src/components/ui/alert-dialog.tsx` with the same viewport-safe shell treatment where appropriate:
- `w-[calc(100vw-2rem)]`
- `box-border`
- safe max width
- maintain current centered positioning

This prevents the delete confirmation modal from developing the same edge clipping behavior.

3. Upgrade the Admin Partners client modal aesthetic

In `src/pages/AdminPartners.tsx`, refine `ClientDossierModal`:
- Use a clean, responsive modal width built on the hardened shell.
- Ensure the modal content uses the system UI font stack.
- Keep consistent internal padding even when the modal is narrow, using `p-6` or an equivalent inner body structure.
- Add `min-w-0` to the modal form body and any flex rows that contain long strings.

Typography hierarchy:
- Modal title/header: `text-slate-900 font-semibold tracking-tight`.
- Helper/description text: `text-slate-500`.
- Labels: `text-slate-500 font-medium text-xs uppercase tracking-wider`.
- This prevents inherited dashboard styling from making the modal feel inconsistent.

4. Improve tactile input interaction states

Update the modal’s form inputs to feel snappy and professional:
- Add `transition-all duration-200`.
- Add high-contrast focus treatment:
  - `focus-visible:ring-2`
  - `focus-visible:ring-slate-950`
  - `focus-visible:ring-offset-2`
- Keep fields `w-full` and add `min-w-0` where they are inside flex layouts.

Specific fields:
- Client Name: full-width, responsive, modern focus state.
- URL Slug row: wrapper gets `flex gap-2 min-w-0`; slug input gets `min-w-0 flex-1`.
- Pixel ID: full-width, modern focus state.
- Access Token: make it better for long tokens by using a taller field with `min-h-[100px]`, `w-full`, `font-mono text-sm`, and the same focus state. If implemented as a textarea, preserve save behavior by still writing the exact token string to the existing `accessToken` state.
- Test Event Code: full-width, responsive, modern focus state.

5. Rename the tracking configuration section to match backend reality

Rename the UI section label from:
- `Meta Pixel Configuration`

to:
- `Meta Conversions API (CAPI)`

Reason:
- The Access Token and Test Event Code are used for server-side event routing, not client-side pixel behavior.
- This keeps the admin UI aligned with the existing server-side CAPI architecture and avoids implying forbidden frontend pixel logic.

6. Defensively contain long URLs and code snippets

Update `LandingPageUrl` in `src/pages/AdminPartners.tsx`:
- Wrapper gets `min-w-0`.
- URL/code text gets `min-w-0 flex-1 truncate` or `break-all` where needed.
- Copy button remains fixed-size and does not compress the content layout.

Goal:
- A very long URL must never widen the modal or create horizontal clipping.

7. Preserve all existing behavior

No logic changes to:
- client create/update Supabase calls,
- meta configuration save flow,
- token dirty-state behavior,
- clipboard copy behavior,
- Safari fallback modal behavior,
- admin auth guard or role checks,
- OTP, scanner, or protected routes.

Validation checklist after approval

- Desktop check: open Add Client and Edit Client; verify clean spacing, no right-side cutoff, and consistent typography.
- Mobile stress test: test at 375px width; verify roughly 16px gap on both sides and no clipping.
- Scrollbar check: force vertical overflow and confirm the scrollbar is slim/subtle, not a chunky default scrollbar.
- Interaction check: tab/click through all fields and confirm the focus ring/offset feels fast and clean.
- Long content check: paste a long CAPI token and verify it stays contained inside the modal.
- Data integrity check: save a CAPI token and confirm the existing backend save path still receives the full value without truncation.