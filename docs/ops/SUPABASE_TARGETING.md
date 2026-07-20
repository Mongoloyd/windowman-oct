# Supabase targeting — Forensic V2 CLI guardrails

Operator guardrails so humans and AI assistants do not accidentally run Supabase CLI commands against the **wrong remote project** while doing `forensic_report_v2` work.

> **Operational authority:** For current project **roles** (LIVE_ACTIVE, LEGACY_PARENT, EMPTY_PREVIEW_V2, LOCAL), read **[SUPABASE_ENVIRONMENT_REGISTRY.md](./SUPABASE_ENVIRONMENT_REGISTRY.md)** first. This doc provides CLI guardrails and workflow scripts. Historical "Production vs Staging" labels are **misleading** — see the registry table below.

**These wrapper scripts protect disciplined workflows; they are not a security boundary.** You can still hit the wrong project with a manual CLI command if you pass the wrong `--project-ref` or link the wrong project.

---

## Remote project roles (operational truth)

| Operational role | Project ref | Hostname pattern | Forensic V2 default? |
|------------------|-------------|------------------|----------------------|
| **LIVE_ACTIVE** (current live WindowMan DB; receives leads) | `zgsofkgddpcntdvpckdq` | `https://zgsofkgddpcntdvpckdq.supabase.co` | **Yes** — default approved remote target |
| **LEGACY_PARENT** (legacy WMProd parent; not current live) | `wkrcyxcnzhwjtdpmfpaf` | `https://wkrcyxcnzhwjtdpmfpaf.supabase.co` | **No** — explicit human approval only |
| **EMPTY_PREVIEW_V2** (empty preview DB for V2 branch experiments) | `aqyptdxsbxqpbgoecykx` | `https://aqyptdxsbxqpbgoecykx.supabase.co` | **No** — separate explicit authorization |
| **LOCAL** (Docker CLI namespace only) | `wm-mvp-forensic-v2-local` | local stack via Supabase CLI | Local disposable stack only |

**Script naming note:** `scripts/supabase/assert-staging.ps1` and comments in deploy wrappers may still say "staging"; in Forensic V2 context that script asserts the linked ref is **`zgsofkgddpcntdvpckdq`** (LIVE_ACTIVE), not a disposable staging environment.

Commands against **LEGACY_PARENT** or **EMPTY_PREVIEW_V2** require **explicit human approval** and must never be the default on experimental branches.

Full operational facts, mutation rules, and ledger drift: [SUPABASE_ENVIRONMENT_REGISTRY.md](./SUPABASE_ENVIRONMENT_REGISTRY.md).

---

## What proves the active CLI target

### `supabase/config.toml` — not remote target proof

`supabase/config.toml` lists `project_id = "wm-mvp-forensic-v2-local"` — the **local Docker CLI namespace**, not a remote Supabase project ref. **Do not use `config.toml` as proof you are on LIVE_ACTIVE or any remote project.**

### `supabase/.temp/project-ref` — local link state

Created/updated by `supabase link`. This file is **machine-local** worktree state (typically gitignored). It records which project the CLI considers “linked.”

Before any Forensic V2 remote read (functions list, migration list, deploy, push), run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/supabase/assert-staging.ps1
```

Exit codes: `0` = expected ref OK (`zgsofkgddpcntdvpckdq`), `2` = missing link file, `3` = wrong ref.

### Fresh clone setup

If `supabase/.temp/project-ref` is missing:

```powershell
npx supabase link --project-ref zgsofkgddpcntdvpckdq
```

Then re-run `assert-staging.ps1`.

### Frontend env (separate from CLI)

Local Vite dev uses `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`). Confirm the hostname contains **`zgsofkgddpcntdvpckdq`**, not `wkrcyxcnzhwjtdpmfpaf`. See [LOCAL_CUTOVER_CHECKLIST.md](../v2-cutover/LOCAL_CUTOVER_CHECKLIST.md).

---

## Forensic V2 remote command rules

1. Run **`assert-staging.ps1`** first (or use a wrapper script that calls it).
2. Prefer **explicit** `--project-ref zgsofkgddpcntdvpckdq` on commands that support it.
3. Do **not** deploy all Edge Functions casually — deploy only functions in the active QA scope.
4. Do **not** set or print secret values in chat, logs, screenshots, or commit messages.

### Wrapper scripts (repo root)

| Script | Purpose |
|--------|---------|
| `scripts/supabase/assert-staging.ps1` | Fail closed unless linked ref is `zgsofkgddpcntdvpckdq` |
| `scripts/supabase/staging-functions-list.ps1` | Assert, then `functions list --project-ref zgsofkgddpcntdvpckdq` |
| `scripts/supabase/staging-migration-list.ps1` | Assert, then migration list (see below) |

Deploy/push/secrets automation is **intentionally not included** in this phase.

### Migration list and `--project-ref`

The installed Supabase CLI **`migration list` does not support `--project-ref`** (only `--linked`, `--local`, `--db-url`).

`staging-migration-list.ps1` therefore runs:

```powershell
npx supabase migration list --linked
```

**only after** `assert-staging.ps1` passes, so `--linked` resolves to LIVE_ACTIVE via `supabase/.temp/project-ref`.

If a future CLI version adds `--project-ref` to `migration list`, prefer that flag and update the script.

---

## Recommended Forensic V2 workflow

1. Verify git branch and `git status --short` (clean tree before risky ops).
2. Run `assert-staging.ps1`.
3. List remote state (read-only): `staging-functions-list.ps1`, `staging-migration-list.ps1`.
4. Run only an **explicitly approved** command with `--project-ref zgsofkgddpcntdvpckdq` (or approved wrapper).
5. Re-assert after any `supabase link` if unsure.

---

## Never do this

- Never rely on `config.toml` as proof of remote target.
- Never run `supabase db push` (or `migration up`) without confirming target ref and role.
- Never run remote commands against **`wkrcyxcnzhwjtdpmfpaf`** without explicit human approval.
- Never run remote mutations against **`aqyptdxsbxqpbgoecykx`** without explicit human approval.
- Never paste secret values (Twilio, Gemini, CAPI, service role, DB passwords) into AI chats, commits, or screenshots.
- Never call `capi-event` from the browser (server-only).

---

## Related V2 cutover docs

- [LOCAL_CUTOVER_CHECKLIST.md](../v2-cutover/LOCAL_CUTOVER_CHECKLIST.md) — branch, env, remote gates before funnel QA
- [SUPABASE_STAGING_VERIFICATION.md](../v2-cutover/SUPABASE_STAGING_VERIFICATION.md) — schema, RLS, RPCs, Edge Functions on LIVE_ACTIVE
- [SUPABASE_ENVIRONMENT_REGISTRY.md](./SUPABASE_ENVIRONMENT_REGISTRY.md) — operational project roles and mutation rules
