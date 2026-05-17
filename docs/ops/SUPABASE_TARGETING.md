# Supabase targeting (production vs staging)

Operator guardrails so humans and AI assistants do not accidentally run Supabase CLI commands against **production** while doing V2 / staging work.

**These wrapper scripts protect disciplined workflows; they are not a security boundary.** You can still hit production with a manual CLI command if you pass the wrong `--project-ref` or link the wrong project.

---

## Two Supabase targets

| Environment | Project ref | Hostname pattern |
|-------------|-------------|------------------|
| **Production** | `wkrcyxcnzhwjtdpmfpaf` | `https://wkrcyxcnzhwjtdpmfpaf.supabase.co` |
| **Staging** | `zgsofkgddpcntdvpckdq` | `https://zgsofkgddpcntdvpckdq.supabase.co` |

Production commands require **explicit human approval** and must never be the default on experimental branches.

---

## What proves the active CLI target

### `supabase/config.toml` — not staging proof

`supabase/config.toml` may list `project_id = "wkrcyxcnzhwjtdpmfpaf"` (production) on purpose so `main` merges do not commit a staging id. **Do not use `config.toml` as proof you are on staging.**

### `supabase/.temp/project-ref` — local link state

Created/updated by `supabase link`. This file is **machine-local** worktree state (typically gitignored). It records which project the CLI considers “linked.”

Before any staging remote read (functions list, migration list, deploy, push), run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/supabase/assert-staging.ps1
```

Exit codes: `0` = staging OK, `2` = missing link file, `3` = wrong ref.

### Fresh clone setup

If `supabase/.temp/project-ref` is missing:

```powershell
npx supabase link --project-ref zgsofkgddpcntdvpckdq
```

Then re-run `assert-staging.ps1`.

### Frontend env (separate from CLI)

Local Vite dev uses `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`). Confirm the hostname contains **`zgsofkgddpcntdvpckdq`**, not `wkrcyxcnzhwjtdpmfpaf`. See [LOCAL_CUTOVER_CHECKLIST.md](../v2-cutover/LOCAL_CUTOVER_CHECKLIST.md).

---

## Staging command rules

1. Run **`assert-staging.ps1`** first (or use a wrapper script that calls it).
2. Prefer **explicit** `--project-ref zgsofkgddpcntdvpckdq` on commands that support it.
3. Do **not** deploy all Edge Functions casually — deploy only functions in the active QA scope.
4. Do **not** set or print secret values in chat, logs, screenshots, or commit messages.

### Wrapper scripts (repo root)

| Script | Purpose |
|--------|---------|
| `scripts/supabase/assert-staging.ps1` | Fail closed unless linked ref is staging |
| `scripts/supabase/staging-functions-list.ps1` | Assert, then `functions list --project-ref zgsofkgddpcntdvpckdq` |
| `scripts/supabase/staging-migration-list.ps1` | Assert, then migration list (see below) |

Deploy/push/secrets automation is **intentionally not included** in this phase.

### Migration list and `--project-ref`

The installed Supabase CLI **`migration list` does not support `--project-ref`** (only `--linked`, `--local`, `--db-url`).

`staging-migration-list.ps1` therefore runs:

```powershell
npx supabase migration list --linked
```

**only after** `assert-staging.ps1` passes, so `--linked` resolves to staging via `supabase/.temp/project-ref`.

If a future CLI version adds `--project-ref` to `migration list`, prefer that flag and update the script.

---

## Recommended staging workflow

1. Verify git branch and `git status --short` (clean tree before risky ops).
2. Run `assert-staging.ps1`.
3. List remote state (read-only): `staging-functions-list.ps1`, `staging-migration-list.ps1`.
4. Run only an **explicitly approved** command with staging ref (or approved wrapper).
5. Re-assert after any `supabase link` if unsure.

---

## Never do this

- Never rely on `config.toml` as proof of staging target.
- Never run `supabase db push` (or `migration up`) without confirming target ref.
- Never deploy to **production** while on experimental branches without explicit approval.
- Never run commands against **`wkrcyxcnzhwjtdpmfpaf`** without explicit human approval.
- Never paste secret values (Twilio, Gemini, CAPI, service role, DB passwords) into AI chats, commits, or screenshots.
- Never call `capi-event` from the browser (server-only).

---

## Related V2 cutover docs

- [LOCAL_CUTOVER_CHECKLIST.md](../v2-cutover/LOCAL_CUTOVER_CHECKLIST.md) — branch, env, staging gates before funnel QA
- [SUPABASE_STAGING_VERIFICATION.md](../v2-cutover/SUPABASE_STAGING_VERIFICATION.md) — schema, RLS, RPCs, Edge Functions on staging
