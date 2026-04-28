# Phase 3J — Validation Checklist

| Area | Check | Status | Evidence / Limitation |
| --- | --- | --- | --- |
| Previous sprint | 3I-D closeout document exists | Pass | `docs/syndicate/phase-3i-dry-run-audit-closeout.md` present. |
| Previous sprint | 3I-D no-write proof documented | Pass | Closeout documents event/outbox counters and dry-run audit persistence. |
| Previous sprint | 3I-D forbidden endpoint scan documented | Pass | Closeout scan found no provider endpoint calls in dry-run path. |
| Build | `bun run build` before 3J | Pass | Completed successfully. |
| Typecheck | `npx tsc --noEmit` before 3J | Pass | Completed successfully. |
| Schema | Required tables exist in connected DB | Pass | `to_regclass` returned all required tables. |
| Schema | Required RPCs exist in connected DB | Pass | `to_regprocedure` returned required admin RPCs. |
| Types | Generated types include required tables/RPCs | Pass | `rg` found required table and function names in `types.ts`. |
| RLS | Protected tables have RLS enabled | Pass | Catalog query returned `relrowsecurity = true` for all target tables. |
| Anon table reads | Direct anon REST probes | Pass with nuance | Protected tables returned `401 permission denied`; `event_logs` and `revenue_signal_dry_run_audits` returned `[]`, not data. |
| Admin RPC anon call | `admin_revenue_signal_eligibility` anon REST call | Pass with grant-review note | Returned `[]`; function body fails closed for non-internal role. EXECUTE grant remains context debt before real contractor access. |
| Admin RPC anon call | `admin_sync_revenue_signals` anon REST call | Pass with grant-review note | Returned `{"ok": false, "error": "forbidden", "external_dispatch": false, "dispatch_created": false}`. |
| Edge auth | `partner-update-disposition` without token | Pass | Returned `401 unauthenticated`; no body mutation path reached. |
| Edge auth | `admin-sync-revenue-signals` without token | Pass | Returned `401 unauthorized`. |
| Cross-client read | Runtime seeded mismatch | Context Debt | No isolated client/contractor fixtures exist in connected dataset; static RLS/RPC review documented. |
| Cross-contractor read | Runtime seeded mismatch | Context Debt | No isolated contractor fixtures exist in connected dataset; static RLS/RPC review documented. |
| Outcome abuse | Missing/invalid payloads | Static Pass / Runtime Limited | Code validates required fields, enums, sold values, value basis, loss reason, tenant mismatches; authenticated mutation tests deferred. |
| Revenue ledger | Duplicate lifecycle/signal behavior | Static Pass | `admin_revenue_signal_eligibility` detects duplicate lifecycle and duplicate signal keys; dry-run blocks. |
| Forbidden endpoints | Provider endpoint scan | Pass | No direct provider calls found in scoped files. |
| No dispatch | External dispatch proof | Pass | No provider calls added; dry-run unsafe flags rejected; edge unauthenticated probes did not dispatch. |
| Final validation | Build/type/Deno checks after artifacts | Pass | `bun run build`, `npx tsc --noEmit`, and both Deno checks passed. |

Verdict: `phase_4_allowed_for_internal_pilot_only`.
