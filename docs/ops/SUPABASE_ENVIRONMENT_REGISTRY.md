# Supabase Environment Registry

Observed operational facts as of **2026-07-16**. Use **operational role**, not dashboard name or legacy parent/preview labels, when choosing a target.

## Purpose

WindowMan currently has three distinct Supabase projects with different roles. Mislabeling them has caused operators and agents to treat the legacy parent or empty preview as live production. This registry is the canonical map for all database, migration, and deployment decisions.

## Canonical Environment Table

| Operational role | Project ref | Supabase branch | Git branch | Operational facts |
|------------------|-------------|-----------------|------------|-------------------|
| **LIVE_ACTIVE** | `zgsofkgddpcntdvpckdq` | `forensic_report_v1` | — | Current live WindowMan database. Receives current leads. Phase 0A installed directly ~`2026-07-16T21:06:33Z`. Automatic CRM delivery cron removed; producer and claim functions fail-closed. |
| **EMPTY_PREVIEW_V2** | `aqyptdxsbxqpbgoecykx` | `forensic_report_v2` | `forensic_report_v2` (PR 157) | Empty preview database. Zero observed leads and deliveries (snapshot 2026-07-16). Phase 0A applied through preview-branch migrations. Must not be mistaken for live. |
| **LEGACY_PARENT** | `wkrcyxcnzhwjtdpmfpaf` | `main` (dashboard: WMProd) | — | Legacy/stale parent. Must not be treated as live because it is named WMProd. Automatic delivery remains armed there; not authorized for mutation in routine work. |

## Mutation Rules

1. **Operational activity determines live** — only `zgsofkgddpcntdvpckdq` (`LIVE_ACTIVE`) receives production leads today.
2. **Explicit project ref on every remote call** — no implicit “linked” or “default” target.
3. **No fallback on lookup failure** — if metadata lookup fails, stop; never assume another project.
4. **`zgsof…` is the only current live project** for lead-bearing production work.
5. **`wkrc…` and `aqypt…` require separate explicit authorization** before any mutation.
6. **Broad production `db push` is prohibited** until migration history is reconciled across all three projects.
7. **Phase 0A ledger debt on live** — Phase 0A was applied directly on `zgsof…` but migration `20260716165508` is not yet recorded in its migration ledger. Ledger state and installed schema can diverge; treat them as separate facts.
8. **Native-lead RPC** — `20260716134535_native_lead_atomic_rpc.sql` remains uninstalled on live unless separately authorized. Its installation status is independent of Phase 0A ledger debt.
9. **Document refs only** — project refs may appear here; never commit API keys, JWTs, passwords, authorization headers, or Vault contents.
10. **Legacy URLs in old files** — some docs/scripts still reference `wkrc…` as “production.” Do not global-replace; trace each consumer and update with explicit authorization.

## Current Known Drift

Document for future audit; **do not deploy or repair in routine passes**:

| Target | Branch health warning | Notes |
|--------|----------------------|-------|
| `zgsof…` / `forensic_report_v1` | `MIGRATIONS_FAILED` | Live schema may include direct-applied changes not in ledger |
| `aqypt…` / `forensic_report_v2` | `FUNCTIONS_FAILED` | Preview; empty of production leads |
| `wkrc…` / `main` | `MIGRATIONS_FAILED` | Legacy parent; automatic delivery still armed |

## Target-Selection Checklist

Before any Supabase CLI command, migration, SQL, or deploy:

- [ ] Named the operational role (`LIVE_ACTIVE`, `EMPTY_PREVIEW_V2`, or `LEGACY_PARENT`)
- [ ] Confirmed explicit `--project-ref` (remote) or `--local` (disposable local stack at `127.0.0.1`)
- [ ] Verified command cannot hit a linked project unless that ref matches the intended role
- [ ] Confirmed human authorization for any mutation outside `EMPTY_PREVIEW_V2` local/preview work
- [ ] Confirmed this change is not a broad `db push` against live or legacy parent

## Prohibited Assumptions

- **WMProd / `wkrc…` is live** — it is legacy parent, not current live.
- **`zgsof…` is “staging”** — it is `LIVE_ACTIVE` and receives real leads.
- **`aqypt…` is live because it is the V2 git branch** — it is an empty preview only.
- **Migration ledger equals installed schema on live** — Phase 0A direct apply created ledger debt.
- **Failed branch health is permission to auto-repair** — audit items only.
- **Missing project metadata → try the other ref** — always stop.

## Future Consolidation Work

- Reconcile migration ledgers across `LIVE_ACTIVE`, `EMPTY_PREVIEW_V2`, and `LEGACY_PARENT`.
- Update stale docs (e.g. `SUPABASE_TARGETING.md`) that invert production/staging refs.
- Record Phase 0A and any direct-applied changes in the live migration ledger after reviewed reconciliation.
- Decide fate of `LEGACY_PARENT` automatic delivery and disarm or decommission with explicit approval.
- Install native-lead RPC on live only after product/routing review per `docs/db/NATIVE_LEAD_RPC_RUNBOOK.md`.
