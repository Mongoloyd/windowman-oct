# WindowMan — Start Here

WindowMan.PRO is a **Verify-to-Reveal** post-quote intelligence product for Florida impact-window homeowners: upload a contractor quote, get a deterministic forensic analysis, unlock the full Truth Report via SMS OTP, then optionally request contractor handoff. Product law lives in [AGENTS.md](../AGENTS.md).

**Warning:** This repo has **protected moat systems** (OTP, reveal, scanner, measurement) and **many historical/planning docs**. Some older docs still describe wrong browser transport or future architecture. **Do not trust stale docs over canonical docs.** Check [DOC_STATUS_REGISTRY.md](./ops/DOC_STATUS_REGISTRY.md) before implementing from any doc.

## Hard stops (all tasks)

- **Tier A edits** require `SPRINT APPROVAL: <name> — <one-line scope>` — see [.cursor/PROTECTED_FILES.md](../.cursor/PROTECTED_FILES.md).
- **Do not deploy** or run Supabase mutation commands without explicit user approval.
- **Do not target** legacy production `wkrcyxcnzhwjtdpmfpaf` from `forensic_report_v2` unless explicitly approved. Default target: staging `zgsofkgddpcntdvpckdq` — see [SUPABASE_TARGETING.md](./ops/SUPABASE_TARGETING.md).
- Invoke **`developer-babysitter`** before editing Tier A–D paths (AGENTS.md §14).

## Task router

| System area | Read first | Supporting | Cursor rule(s) | Stop / warning |
|---|---|---|---|---|
| **Verify-to-Reveal / OTP / Twilio** | [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md), [PROTECTED_FILES.md](../.cursor/PROTECTED_FILES.md) | [REPORT_ACCESS_BROWSER_QA.md](./v2-cutover/REPORT_ACCESS_BROWSER_QA.md), [RPC_TYPE_CONTRACT_REGISTRY.md](./ops/RPC_TYPE_CONTRACT_REGISTRY.md) | `twilio.mdc` | Tier A; no direct browser `get_analysis_*` RPC; no client OTP authority |
| **Supabase Edge Functions** | [SUPABASE_FUNCTION_MANIFEST.md](./ops/SUPABASE_FUNCTION_MANIFEST.md) | [RPC_TYPE_CONTRACT_REGISTRY.md](./ops/RPC_TYPE_CONTRACT_REGISTRY.md), [PROJECT_OPERATING_MAP.md](./ops/PROJECT_OPERATING_MAP.md) | `supabase.mdc`, `deployment-env.mdc` | Do not invent functions; do not deploy without approval |
| **Supabase boundaries / deploy** | [SUPABASE_TARGETING.md](./ops/SUPABASE_TARGETING.md) | [LOCAL_CUTOVER_CHECKLIST.md](./v2-cutover/LOCAL_CUTOVER_CHECKLIST.md) | `deployment-env.mdc`, `supabase.mdc` | `config.toml` project_id ≠ staging proof; confirm linked ref |
| **Scanner / OCR / scoring** | [SCANNER_BRAIN_CURRENT_VS_TARGET.md](./report/SCANNER_BRAIN_CURRENT_VS_TARGET.md) | [SCANNER_MODEL_GOVERNANCE.md](./ops/SCANNER_MODEL_GOVERNANCE.md) | `supabase.mdc` | Tier A `scan-quote/**`; Gemini extracts only; TS scores |
| **Report rendering / preview–full** | [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md) | [FORENSIC_PROPS_CONTRACT.md](./report/FORENSIC_PROPS_CONTRACT.md), [SIGNAL_CONTAINER_MAP.md](./report/SIGNAL_CONTAINER_MAP.md) | `ui-ux.mdc`, `twilio.mdc` | Tier A orchestrators/services; `/visual/*` is mock-only |
| **Tracking / CAPI / GTM** | [CANONICAL_MEASUREMENT_ARCHITECTURE.md](./measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md) | [EVENT_OWNERSHIP_MODEL.md](./tracking/EVENT_OWNERSHIP_MODEL.md), [CAPI_OPERATOR_HANDOFF_PACKET.md](./measurement/CAPI_OPERATOR_HANDOFF_PACKET.md) | `deployment-env.mdc` | Tier C; no browser `fbq('track')` except PageView |
| **Netlify / frontend env** | [netlify-deploy-checklist.md](./deployment/netlify-deploy-checklist.md) | [SUPABASE_TARGETING.md](./ops/SUPABASE_TARGETING.md) | `deployment-env.mdc` | No secrets in Vite client; Edge secrets stay in Supabase |
| **Admin dashboard** | [SUPABASE_FUNCTION_MANIFEST.md](./ops/SUPABASE_FUNCTION_MANIFEST.md) (admin-* rows) | [TABLE_ACCESS_MODEL.md](./db/TABLE_ACCESS_MODEL.md) | `supabase.mdc` | adminAuth paths; no broad admin sprawl per AGENTS.md |
| **Partner / contractor portal** | [phase-4a-contractor-portal-access-model.md](./phase-4/phase-4a-contractor-portal-access-model.md) | phase-4b–4e docs, manifest contractor functions | `supabase.mdc` | Planning slices exist; defer portal sprawl per AGENTS.md §2 |
| **Lead capture / homepage** | [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md) | manifest (`qualify-homepage-lead`, `capture-truth-gate-lead`) | `ui-ux.mdc` | phase-0/funnel maps are **STALE WITH BANNER** for transport |
| **Database / RLS / migrations** | [TABLE_ACCESS_MODEL.md](./db/TABLE_ACCESS_MODEL.md) | [DB_PREFLIGHT_STATUS.md](./db/DB_PREFLIGHT_STATUS.md), [TYPEGEN_WORKFLOW.md](./db/TYPEGEN_WORKFLOW.md) | `supabase.mdc` | Tier B migrations; never weaken RLS for convenience |
| **UI-only visual changes** | [AGENTS.md](../AGENTS.md) §8 (`/visual/*`) | [FORENSIC_PROPS_CONTRACT.md](./report/FORENSIC_PROPS_CONTRACT.md) | `ui-ux.mdc` | Mock routes ≠ production funnel; no fake backend in UI |
| **Dev tools / QA bypasses** | [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md) §6 | `.lovable/memory/features/dev-bypass.md` | `twilio.mdc`, `deployment-env.mdc` | Tier A `dev-report-unlock`, `otpQaBypass.ts`; DEV-only |
| **Deprecated / stale docs** | [DOC_STATUS_REGISTRY.md](./ops/DOC_STATUS_REGISTRY.md) | Bannered funnel maps, phase-0, COPILOT spec | — | Do not implement from **STALE WITH BANNER** bodies |

## Deep map

Subsystem detail, code anchors, and safe-edit boundaries: [PROJECT_OPERATING_MAP.md](./ops/PROJECT_OPERATING_MAP.md).

## Canonical index

| Doc | Role |
|---|---|
| [AGENTS.md](../AGENTS.md) | Product law, sprint priority, routes |
| [.cursor/PROTECTED_FILES.md](../.cursor/PROTECTED_FILES.md) | Tier A–D protected paths |
| [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md) | OTP/reveal transport authority |
| [SUPABASE_FUNCTION_MANIFEST.md](./ops/SUPABASE_FUNCTION_MANIFEST.md) | Edge Function inventory |
| [SUPABASE_TARGETING.md](./ops/SUPABASE_TARGETING.md) | Staging vs production refs |
| [DOC_STATUS_REGISTRY.md](./ops/DOC_STATUS_REGISTRY.md) | High-risk doc status labels |
