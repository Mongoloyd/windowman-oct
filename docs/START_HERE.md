# WindowMan — Start Here

WindowMan is a **Verify-to-Reveal** post-quote intelligence product for Florida impact-window homeowners: upload a contractor quote, get a deterministic forensic analysis, unlock the full Truth Report via SMS OTP, then optionally request contractor handoff. Product law lives in [AGENTS.md](../AGENTS.md).

**Warning:** This repo has **protected moat systems** (OTP, reveal, scanner, measurement) and **many historical/planning docs**. Some older docs still describe wrong browser transport or future architecture. **Do not trust stale docs over canonical docs.** Check [DOC_STATUS_REGISTRY.md](./ops/DOC_STATUS_REGISTRY.md) before implementing from any doc.

## Governance routing (read first)

| Need | Read |
|---|---|
| Repository product / agent law | [AGENTS.md](../AGENTS.md) |
| Task-specific doc routing (this file) | [docs/START_HERE.md](./START_HERE.md) |
| Protected paths / approval tiers | [.cursor/PROTECTED_FILES.md](../.cursor/PROTECTED_FILES.md) |
| Document authority labels | [DOC_STATUS_REGISTRY.md](./ops/DOC_STATUS_REGISTRY.md) |
| Protected-system / repository-wide governing law | [PROTECTED_SYSTEMS.md](./architecture/PROTECTED_SYSTEMS.md) — read before any protected-system work |

**Reading order for `/scan` and intake:** [PROTECTED_SYSTEMS.md](./architecture/PROTECTED_SYSTEMS.md) → route-specific law → policy ADR → Proposed implementation ADR (ADR-005 is not implementation authority).

**Cursor rule loading:** `.cursor/rules/00-windowman-core.mdc` has `alwaysApply: true`. Domain rules (`supabase.mdc`, `twilio.mdc`, `ui-ux.mdc`, `deployment-env.mdc`) are **conditional** — attached when the task matches their description. They must not weaken [AGENTS.md](../AGENTS.md).

## Hard stops (all tasks)

- **Tier A edits** require `SPRINT APPROVAL: <name> — <one-line scope>` — see [.cursor/PROTECTED_FILES.md](../.cursor/PROTECTED_FILES.md).
- **Do not deploy** or run Supabase mutation commands without explicit user approval.
- **Do not target** legacy parent `wkrcyxcnzhwjtdpmfpaf` from `forensic_report_v2` without explicit approval. Default approved Forensic V2 remote target: **`zgsofkgddpcntdvpckdq`** — see [SUPABASE_ENVIRONMENT_REGISTRY.md](./ops/SUPABASE_ENVIRONMENT_REGISTRY.md) (operational roles) and [SUPABASE_TARGETING.md](./ops/SUPABASE_TARGETING.md) (CLI guardrails).
- **Any edit that touches Tier A–D files** must invoke **`developer-babysitter` before coding** — required by [AGENTS.md](../AGENTS.md) ("Protected Systems and Mutation Safety") and `.cursor/rules/00-windowman-core.mdc`; not optional.
- Whole-file Tier A orchestrators (`ReportClassic.tsx`, `PostScanReportSwitcher.tsx`) are **not** “visual-only” without scoped `SPRINT APPROVAL` proving zero OTP/reveal orchestration impact.

## Task router

| System area | Read first | Supporting | Cursor rule(s) | Stop / warning |
|---|---|---|---|---|
| **Verify-to-Reveal / OTP / Twilio** | [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md), [PROTECTED_FILES.md](../.cursor/PROTECTED_FILES.md) | [REPORT_ACCESS_BROWSER_QA.md](./v2-cutover/REPORT_ACCESS_BROWSER_QA.md), [RPC_TYPE_CONTRACT_REGISTRY.md](./ops/RPC_TYPE_CONTRACT_REGISTRY.md) | `twilio.mdc` | Tier A; no direct browser `get_analysis_*` RPC; no client OTP authority |
| **Supabase Edge Functions** | [SUPABASE_FUNCTION_MANIFEST.md](./ops/SUPABASE_FUNCTION_MANIFEST.md) | [RPC_TYPE_CONTRACT_REGISTRY.md](./ops/RPC_TYPE_CONTRACT_REGISTRY.md), [PROJECT_OPERATING_MAP.md](./ops/PROJECT_OPERATING_MAP.md) | `supabase.mdc`, `deployment-env.mdc` | Do not invent functions; do not deploy without approval |
| **Supabase boundaries / deploy** | [SUPABASE_ENVIRONMENT_REGISTRY.md](./ops/SUPABASE_ENVIRONMENT_REGISTRY.md), [SUPABASE_TARGETING.md](./ops/SUPABASE_TARGETING.md) | [LOCAL_CUTOVER_CHECKLIST.md](./v2-cutover/LOCAL_CUTOVER_CHECKLIST.md) | `deployment-env.mdc`, `supabase.mdc` | `config.toml` project_id ≠ remote target proof; confirm linked ref |
| **Scanner / OCR / scoring** | [SCANNER_BRAIN_CURRENT_VS_TARGET.md](./report/SCANNER_BRAIN_CURRENT_VS_TARGET.md) | [SCANNER_MODEL_GOVERNANCE.md](./ops/SCANNER_MODEL_GOVERNANCE.md) | `supabase.mdc` | Tier A `scan-quote/**`; Gemini extracts only; TS scores |
| **Report rendering / preview–full** | [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md) | [FORENSIC_PROPS_CONTRACT.md](./report/FORENSIC_PROPS_CONTRACT.md), [SIGNAL_CONTAINER_MAP.md](./report/SIGNAL_CONTAINER_MAP.md) | `ui-ux.mdc`, `twilio.mdc` | Tier A orchestrators not “visual-only”; prefer `TruthReportClassic` / `/visual/*` for layout-only |
| **Tracking / CAPI / GTM** | [CANONICAL_MEASUREMENT_ARCHITECTURE.md](./measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md), [EVENT_OWNERSHIP_MODEL.md](./tracking/EVENT_OWNERSHIP_MODEL.md) | [CAPI_OPERATOR_HANDOFF_PACKET.md](./measurement/CAPI_OPERATOR_HANDOFF_PACKET.md) | `deployment-env.mdc` | Tier C; read both canonical docs first; no ad hoc browser conversion events |
| **Window Oracle / continual learning / Evolution Engine** | [ORACLE_EVOLUTION_PROTOCOL.md](./oracle/ORACLE_EVOLUTION_PROTOCOL.md) | [ORACLE_DATA_VISIBILITY_AUDIT.md](./oracle/ORACLE_DATA_VISIBILITY_AUDIT.md), [AGENTS.md](../AGENTS.md) Oracle section | — | Recommendations do not authorize mutations; human-gated sprints only |
| **Netlify / frontend env** | [netlify-deploy-checklist.md](./deployment/netlify-deploy-checklist.md) | [SUPABASE_TARGETING.md](./ops/SUPABASE_TARGETING.md) | `deployment-env.mdc` | No secrets in Vite client; Edge secrets stay in Supabase |
| **Admin dashboard** | [SUPABASE_FUNCTION_MANIFEST.md](./ops/SUPABASE_FUNCTION_MANIFEST.md) (admin-* rows) | [TABLE_ACCESS_MODEL.md](./db/TABLE_ACCESS_MODEL.md) | `supabase.mdc` | adminAuth paths; no broad admin sprawl per AGENTS.md |
| **Partner / contractor portal** | [phase-4a-contractor-portal-access-model.md](./phase-4/phase-4a-contractor-portal-access-model.md) | phase-4b–4e docs, manifest contractor functions | `supabase.mdc` | No direct/raw access to private homeowner quote files without product/security sprint |
| **Lead capture / homepage** | [CANONICAL_IDENTITY_GLOSSARY.md](./tracking/CANONICAL_IDENTITY_GLOSSARY.md) (proposed ID law), [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md) | [CANONICAL_INTAKE_ROUTE_MATRIX.md](./tracking/CANONICAL_INTAKE_ROUTE_MATRIX.md) (proposed current→target matrix), manifest (`qualify-homepage-lead`, `capture-truth-gate-lead`), [EVENT_OWNERSHIP_MODEL.md](./tracking/EVENT_OWNERSHIP_MODEL.md) | `ui-ux.mdc` | Read glossary **before** the matrix; neither doc authorizes implementation; D1–D4 are operator decisions; phase-0/funnel maps are **STALE WITH BANNER** for transport |
| **Database / RLS / migrations** | [TABLE_ACCESS_MODEL.md](./db/TABLE_ACCESS_MODEL.md) | [DB_PREFLIGHT_STATUS.md](./db/DB_PREFLIGHT_STATUS.md), [TYPEGEN_WORKFLOW.md](./db/TYPEGEN_WORKFLOW.md) | `supabase.mdc` | Tier B migrations; never weaken RLS for convenience |
| **UI-only visual changes** | [AGENTS.md](../AGENTS.md) — "Routes / Dev / Visual / Sandbox Rules" (`/visual/*`) | [FORENSIC_PROPS_CONTRACT.md](./report/FORENSIC_PROPS_CONTRACT.md) | `ui-ux.mdc` | Confirm exact paths; avoid `Index.tsx` orchestration, upload, OTP, report, tracking, scanner, Supabase |
| **Dev tools / QA bypasses** | [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md) §6 | `.lovable/memory/features/dev-bypass.md` | `twilio.mdc`, `deployment-env.mdc` | Tier A `dev-report-unlock`, `otpQaBypass.ts`; DEV-only |
| **Deprecated / stale docs** | [DOC_STATUS_REGISTRY.md](./ops/DOC_STATUS_REGISTRY.md) | Bannered funnel maps, phase-0, COPILOT spec | — | Do not implement from **STALE WITH BANNER** bodies |
| **Protected systems (all routes)** | [PROTECTED_SYSTEMS.md](./architecture/PROTECTED_SYSTEMS.md) | [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md), [PROTECTED_FILES.md](../.cursor/PROTECTED_FILES.md) | `supabase.mdc`, `twilio.mdc` | Governing law only — `Implementation authority: None`; no runtime change from doc adoption |
| **`/scan` route, UX, lifecycle, upload, preview, contact, OTP, report, rollout** | [ROUTE_SCAN.md](./architecture/ROUTE_SCAN.md) | [PROTECTED_SYSTEMS.md](./architecture/PROTECTED_SYSTEMS.md), [ADR-003](./adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md) | `ui-ux.mdc`, `twilio.mdc`, `supabase.mdc` | Read PROTECTED_SYSTEMS first; route not mounted until authorized implementation sprint |
| **Document-extracted contact, OCR prefill, lead attachment, mandatory OTP policy** | [ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md](./adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md) | [PROTECTED_SYSTEMS.md](./architecture/PROTECTED_SYSTEMS.md), [ROUTE_SCAN.md](./architecture/ROUTE_SCAN.md) | `twilio.mdc` | Policy ADR — not ADR-005 mechanics |
| **Quote disposition, market observations, verified outcomes, benchmarks, outcome provenance** | [ADR-004-quote-disposition-and-ledger-layer-separation.md](./adr/ADR-004-quote-disposition-and-ledger-layer-separation.md) | [PROTECTED_SYSTEMS.md](./architecture/PROTECTED_SYSTEMS.md) | — | Data-trust law — independent of contact/OTP route mechanics |
| **Proposed server-minted intake capability (implementation planning only)** | [ADR-005-server-minted-quote-intake-capability.md](./adr/ADR-005-server-minted-quote-intake-capability.md) | Canonical law above (PROTECTED_SYSTEMS → ROUTE_SCAN → ADR-003 / ADR-004 as applicable) | — | **Proposed implementation architecture. Not implementation authority.** Read only after applicable CANONICAL law. Prerequisites 1–4 satisfied by governance adoption; 5–38 remain blocking |

## Deep map

Subsystem detail, code anchors, and safe-edit boundaries: [PROJECT_OPERATING_MAP.md](./ops/PROJECT_OPERATING_MAP.md).

## Canonical index

| Doc | Role |
|---|---|
| [AGENTS.md](../AGENTS.md) | Canonical root product / agent law |
| [docs/START_HERE.md](./START_HERE.md) | Task router / entry map |
| [.cursor/PROTECTED_FILES.md](../.cursor/PROTECTED_FILES.md) | Tier A–D protected paths |
| [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md) | OTP/reveal transport authority |
| [PROTECTED_SYSTEMS.md](./architecture/PROTECTED_SYSTEMS.md) | Repository-wide protected-system governing law |
| [ROUTE_SCAN.md](./architecture/ROUTE_SCAN.md) | Future `/scan` route governing law |
| [ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md](./adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md) | Document-extracted contact and mandatory OTP policy |
| [ADR-004-quote-disposition-and-ledger-layer-separation.md](./adr/ADR-004-quote-disposition-and-ledger-layer-separation.md) | Quoted observation vs verified outcome trust law |
| [ORACLE_EVOLUTION_PROTOCOL.md](./oracle/ORACLE_EVOLUTION_PROTOCOL.md) | Oracle continual learning / Evolution Engine |
| [SUPABASE_FUNCTION_MANIFEST.md](./ops/SUPABASE_FUNCTION_MANIFEST.md) | Edge Function inventory |
| [SUPABASE_ENVIRONMENT_REGISTRY.md](./ops/SUPABASE_ENVIRONMENT_REGISTRY.md) | Operational Supabase project roles |
| [SUPABASE_TARGETING.md](./ops/SUPABASE_TARGETING.md) | CLI guardrails for Forensic V2 remote work |
| [DOC_STATUS_REGISTRY.md](./ops/DOC_STATUS_REGISTRY.md) | High-risk doc status labels |
