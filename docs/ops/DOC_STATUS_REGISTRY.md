# Document Status Registry — High-Risk Docs Only

Tracks **high-risk** documentation only — not every markdown file in the repo.

## How to use this registry

1. Before implementing from a doc, check its **status** here.
2. **CANONICAL** docs override conflicting older docs on the same topic.
3. **STALE WITH BANNER** docs may contain wrong transport/details in the body — follow the banner link to the canonical doc. **These docs must not be used to justify code changes**; the banner and linked canonical doc win.
4. **HISTORICAL** docs are planning snapshots or evidence packs — context only, not implementation authority.
5. **Do not delete or archive files based only on this registry.** Archival requires a dedicated sprint with explicit scope.
6. **Update this registry** when promoting, demoting, or adding stale banners to docs.

---

## CANONICAL

| Document | Topic |
|---|---|
| [docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md](../reveal/VERIFY_TO_REVEAL_CONTRACT.md) | Verify-to-Reveal transport and OTP/reveal protection |
| [.cursor/PROTECTED_FILES.md](../../.cursor/PROTECTED_FILES.md) | Tier A–D protected path manifest |
| [docs/ops/SUPABASE_FUNCTION_MANIFEST.md](./SUPABASE_FUNCTION_MANIFEST.md) | Edge Function inventory, auth models, deploy matrix |
| [docs/ops/SUPABASE_TARGETING.md](./SUPABASE_TARGETING.md) | Staging vs production Supabase project refs |
| [docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md](../measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md) | Browser vs server measurement policy |
| [docs/report/SCANNER_BRAIN_CURRENT_VS_TARGET.md](../report/SCANNER_BRAIN_CURRENT_VS_TARGET.md) | Scanner Brain architecture (extract vs score) |
| [docs/db/TABLE_ACCESS_MODEL.md](../db/TABLE_ACCESS_MODEL.md) | Table access classes and RLS patterns |
| [docs/START_HERE.md](../START_HERE.md) | Repo entry point and task router |
| [docs/ops/PROJECT_OPERATING_MAP.md](./PROJECT_OPERATING_MAP.md) | Subsystem map and safe-edit boundaries |

---

## SUPPORTING

| Document | Supports |
|---|---|
| [docs/ops/RPC_TYPE_CONTRACT_REGISTRY.md](./RPC_TYPE_CONTRACT_REGISTRY.md) | Funnel RPC/Edge payload shapes |
| [docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md](../v2-cutover/REPORT_ACCESS_BROWSER_QA.md) | Signed Classic OTP + report-access QA |
| [docs/tracking/EVENT_OWNERSHIP_MODEL.md](../tracking/EVENT_OWNERSHIP_MODEL.md) | Business vs telemetry event owners |
| [docs/measurement/CAPI_OPERATOR_HANDOFF_PACKET.md](../measurement/CAPI_OPERATOR_HANDOFF_PACKET.md) | CAPI protected boundaries (Tier C) |
| [docs/measurement/MEASUREMENT_DISCREPANCY_DECISION_TREE.md](../measurement/MEASUREMENT_DISCREPANCY_DECISION_TREE.md) | Measurement triage; §H protected-file stop |
| [docs/report/FORENSIC_PROPS_CONTRACT.md](../report/FORENSIC_PROPS_CONTRACT.md) | V2 report prop ↔ backend mapping |
| [docs/report/SIGNAL_CONTAINER_MAP.md](../report/SIGNAL_CONTAINER_MAP.md) | Signal-to-field mapping for V2 UI |
| [docs/ops/SCANNER_MODEL_GOVERNANCE.md](./SCANNER_MODEL_GOVERNANCE.md) | Gemini model change operator process |
| [docs/deployment/netlify-deploy-checklist.md](../deployment/netlify-deploy-checklist.md) | Netlify public env vs Edge secrets |
| [AGENTS.md](../../AGENTS.md) | Product law, sprint priority, routes |
| [CLAUDE.md](../../CLAUDE.md) | Hard systems guardrails |
| [.cursor/rules/twilio.mdc](../../.cursor/rules/twilio.mdc) | Twilio/OTP security rules |

---

## STALE WITH BANNER

Body content may be wrong; **banner + canonical doc win.**

| Document | Known issue |
|---|---|
| [docs/funnel/FUNNEL_SUPABASE_CALL_MAP.md](../funnel/FUNNEL_SUPABASE_CALL_MAP.md) | Direct browser RPC for preview/full |
| [docs/v2-cutover/FUNNEL_SUPABASE_CALL_MAP.md](../v2-cutover/FUNNEL_SUPABASE_CALL_MAP.md) | Same transport drift |
| [docs/sprints/phase-0-repo-truth-audit.md](../sprints/phase-0-repo-truth-audit.md) | Historical audit; transport superseded |
| [CANONICAL_REPO_EVIDENCE.md](../../CANONICAL_REPO_EVIDENCE.md) | Evidence snapshot; transport outdated |
| [docs/COPILOT_LOVABLE_INTEGRATION_SPEC.md](../COPILOT_LOVABLE_INTEGRATION_SPEC.md) | Copilot integration; direct RPC claims |

---

## HISTORICAL (planning / evidence — not implementation authority)

| Document group | Notes |
|---|---|
| [docs/phase-4/](../phase-4/) | Contractor portal planning slices — partial implementation |
| [docs/syndicate/](../syndicate/) | Future syndicate/routing plans — defer per AGENTS.md §2 |
| [docs/dispatch-control-plane/](../dispatch-control-plane/) | Dispatch control-plane design memos |
| [docs/sprints/phase-0-repo-truth-audit.md](../sprints/phase-0-repo-truth-audit.md) | Audit-lock snapshot (also bannered) |
| [CANONICAL_REPO_EVIDENCE.md](../../CANONICAL_REPO_EVIDENCE.md) | Point-in-time evidence extraction |

---

## ARCHIVE CANDIDATE

None listed yet. Candidates require explicit deprecation sprint approval before move/delete.

**Possible future candidates (do not archive without sprint):** `PhoneVerifyModal.tsx` / `VerifyGate.tsx` if deprecation sprint confirms no reuse — see PROTECTED_FILES “possibly deprecated” note.
