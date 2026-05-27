# WindowMan Project Operating Map

**Purpose:** Maintainer-grade map of major subsystems, canonical docs, protected boundaries, and common mistakes. **Does not override** canonical contracts — links to them.

**Authority:** If this map disagrees with [VERIFY_TO_REVEAL_CONTRACT.md](../reveal/VERIFY_TO_REVEAL_CONTRACT.md), [CANONICAL_MEASUREMENT_ARCHITECTURE.md](../measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md), or live code on transport/security, **those win**.

---

## Architecture snapshot

```
Homepage / TruthGate (lead capture)
  → UploadZone → start-upload-scan-session → quotes storage
  → scan-quote (Gemini extract + TS score) → analyses
  → report-access preview → locked report UI
  → send-otp / verify-otp (Twilio Verify)
  → report-access full → Truth Report reveal
  → CTAs (contractor brief, callback) + tracking (GTM + server CAPI)
Admin / partner surfaces (separate auth lanes)
```

**Identity keys:** `lead_id` (persistent), `scan_session_id` (per scan), `event_id` (dedup — generate once).

---

## Supabase project boundaries

| Ref | Role | Rule |
|---|---|---|
| `zgsofkgddpcntdvpckdq` | Forensic V2 / **staging-current target** | Default for `forensic_report_v2` work |
| `wkrcyxcnzhwjtdpmfpaf` | Legacy Lovable/main **production** | **Do not target** from this branch without explicit approval |

Proof of CLI target: [SUPABASE_TARGETING.md](./SUPABASE_TARGETING.md) — not `supabase/config.toml` alone.

---

## Safe edit boundaries

| Boundary | Examples | Gate |
|---|---|---|
| **Docs-only** | START_HERE, ops maps, banners | No runtime change |
| **UI-only** | Copy, layout, `/visual/*` mocks | No backend authority in components |
| **Protected Tier A** | OTP, reveal, scan-quote, report services | `SPRINT APPROVAL:` + babysitter |
| **Supabase / Edge Function** | `supabase/functions/*`, RPCs, RLS | Tier A/B; deploy only with approval |
| **Deployment / secrets** | Netlify env, Edge secrets, CI | `deployment-env.mdc`; explicit user OK |

---

## Verify-to-Reveal read path (OTP / reveal tasks)

1. [VERIFY_TO_REVEAL_CONTRACT.md](../reveal/VERIFY_TO_REVEAL_CONTRACT.md)
2. [.cursor/PROTECTED_FILES.md](../../.cursor/PROTECTED_FILES.md)
3. [SUPABASE_FUNCTION_MANIFEST.md](./SUPABASE_FUNCTION_MANIFEST.md) — funnel functions section

Browser transport (production): `reportService.ts` → `report-access` → service-role RPC. OTP: `phoneVerificationService.ts` → `send-otp` / `verify-otp`.

---

## System-by-system map

| Area | Purpose | Canonical doc(s) | Code anchors (paths only) | Edge Functions | Tier | Rule(s) | Common mistakes |
|---|---|---|---|---|---|---|---|
| **Verify-to-Reveal / OTP** | SMS gate + full reveal | [VERIFY_TO_REVEAL_CONTRACT](../reveal/VERIFY_TO_REVEAL_CONTRACT.md) | `PostScanReportSwitcher.tsx`, `ReportClassic.tsx`, `usePhonePipeline.ts`, `phoneVerificationService.ts`, `reportService.ts`, `LockedOverlay.tsx` | `send-otp`, `verify-otp`, `report-access` | A | `twilio.mdc` | Direct browser RPC; client OTP validation; CSS-only unlock |
| **Edge Functions** | Backend API surface | [SUPABASE_FUNCTION_MANIFEST](./SUPABASE_FUNCTION_MANIFEST.md) | `src/services/*`, `src/components/UploadZone.tsx` | 52 functions — see manifest | A/C varies | `supabase.mdc` | Inventing functions; `verify_jwt=false` ≠ no auth |
| **Deploy / targeting** | Which Supabase project | [SUPABASE_TARGETING](./SUPABASE_TARGETING.md) | `scripts/supabase/assert-staging.ps1` | — | B config blocks | `deployment-env.mdc` | Hitting prod from V2 branch; trusting config.toml |
| **Scanner / scoring** | Quote analysis moat | [SCANNER_BRAIN_CURRENT_VS_TARGET](../report/SCANNER_BRAIN_CURRENT_VS_TARGET.md) | `supabase/functions/scan-quote/**`, `UploadZone.tsx` | `scan-quote` | A | `supabase.mdc` | AI-generated grades; skipping deterministic scoring |
| **Report UI** | Preview vs full presentation | Contract + [FORENSIC_PROPS_CONTRACT](../report/FORENSIC_PROPS_CONTRACT.md) | `TruthReportClassic.tsx`, `forensic-report/*`, `useAnalysisData.ts` | `report-access` | A | `ui-ux.mdc` | Treating `ReportClassic` / `PostScanReportSwitcher` as “visual-only” without scoped approval |
| **Tracking / CAPI** | Conversion measurement | [CANONICAL_MEASUREMENT_ARCHITECTURE](../measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md) + [EVENT_OWNERSHIP_MODEL](../tracking/EVENT_OWNERSHIP_MODEL.md) | `trackConversion.ts`, `trackEvent.ts`, `capi-event` | `capi-event`, dispatch workers | C | `deployment-env.mdc` | Ad hoc browser conversion events; bypassing event ownership |
| **Netlify / env** | Frontend build config | [netlify-deploy-checklist](../deployment/netlify-deploy-checklist.md) | `VITE_*` in client only | secrets in Supabase | — | `deployment-env.mdc` | Service-role or Twilio keys in Vite |
| **Admin** | Internal operator tools | [SUPABASE_FUNCTION_MANIFEST](./SUPABASE_FUNCTION_MANIFEST.md) | `adminDataService.ts`, `admin-data/**`, `_shared/adminAuth.ts` | `admin-data`, `admin-*` | B sprint-only | `supabase.mdc` | **BLOCK** auth weakening (not PAUSE); temporary bypass forbidden |
| **Partner / contractor** | B2B portal (partial) | [phase-4a](../phase-4/phase-4a-contractor-portal-access-model.md) | `contractorAccess.ts`, `/partner/*` | `accept-invite`, `contractor-actions` | B RLS | `supabase.mdc` | Granting contractors raw/direct access to private quote files |
| **Lead / homepage** | Acquisition intake | Contract (flow) + manifest | `Index.tsx`, TruthGate, `qualify-homepage-lead` | `capture-truth-gate-lead`, `qualify-homepage-lead` | varies | `ui-ux.mdc` | “UI-only” edits that touch upload/OTP/report/tracking/scanner/Supabase/orchestration on `Index.tsx` |
| **Database / RLS** | Data access model | [TABLE_ACCESS_MODEL](../db/TABLE_ACCESS_MODEL.md) | `supabase/migrations/**`, `types.ts` | RPCs in migrations | B | `supabase.mdc` | Drive-by migration edits; anon SELECT on analyses |
| **UI visual lab** | Mock QA layouts | [AGENTS.md](../../AGENTS.md) §8 | `/visual/*`, `/sandbox/*`, `DevReportPreview.tsx` | none on mock paths | D `App.tsx` | `ui-ux.mdc` | Wiring mock routes to live OTP/reveal |
| **Dev / QA bypass** | Deterministic dev paths | Contract §6 + `.lovable/memory/features/dev-bypass.md` | `dev-report-unlock`, `DevQuoteGenerator.tsx` | `dev-report-unlock`, `otpQaBypass.ts` | A | `twilio.mdc` | Generalizing dev bypass to production |
| **Stale / historical** | Old or planning docs | [DOC_STATUS_REGISTRY](./DOC_STATUS_REGISTRY.md) | — | — | — | — | Implementing from bannered or syndicate plans |

---

## Related indexes

- Entry point: [START_HERE.md](../START_HERE.md)
- Doc status: [DOC_STATUS_REGISTRY.md](./DOC_STATUS_REGISTRY.md)
- Product law: [AGENTS.md](../../AGENTS.md)
- Protected paths: [.cursor/PROTECTED_FILES.md](../../.cursor/PROTECTED_FILES.md)

**Maintenance:** When adding a protected surface or canonical doc, update PROTECTED_FILES first, then this map and DOC_STATUS_REGISTRY.
