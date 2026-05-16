# PRODUCTION FREEZE — STANDBY MODE

Status: **STANDBY**. No runtime code changes until further notice.

## What just happened

- PR #130 merged into `main`. The dark forensic UI surface (`src/components/forensic-report/*`) is present and structurally complete.
- `ExecutiveSummaryBand.tsx`, `ForensicAuditReport.tsx`, and `PartialRevealHero.tsx` already contain the required band wiring and issue-count line.
- All production backend-connected integration work is moving to a **local Cursor/VS Code environment** on a separate GitHub branch + Supabase staging branch.

## Current architecture decisions (locked)

| Route | Decision |
|---|---|
| `/` | **Stays the existing homepage** (`src/pages/Index.tsx`). No cutover. |
| `/scan` | Will become the V2 intake/funnel route (`PreUploadIntake` + production wiring). |
| `/report/forensic/:sessionId` | Will become the dark forensic reveal route. |
| `/report/classic/:sessionId` | Remains fallback until QA passes on forensic reveal. |

## Off-limits (DO NOT TOUCH in Lovable)

- `src/App.tsx`
- `/` homepage route or homepage components
- Production report routing
- Supabase Edge Functions
- Database migrations
- RLS policies
- Storage policies
- OTP / Twilio logic
- `scan-quote`
- CAPI / conversion tracking
- Report reveal authorization logic

## What is okay in Lovable (if requested)

- Purely presentational UI tweaks inside `src/components/forensic-report/*` (colors, spacing, copy) — **only if they do not require new backend wiring**.
- Updates to this plan file.
- Documentation, comments, or Markdown.

## Next gate

Local dev will wire `PreUploadIntake` → `start-upload-scan-session` → `scan-quote` → preview → OTP → `ForensicAuditReport` reveal. Once that staging branch passes QA, a new Lovable session may be opened to promote `/scan` and `/report/forensic/:sessionId` to public routes in `App.tsx`.
