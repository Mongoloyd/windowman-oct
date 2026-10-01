# AGENTS.md — WindowMan / wm-mvp
## Canonical Product Law + AI Agent Operating Contract

> **Authority:** This is the canonical repo-level product and agent policy for `wm-mvp`.
> Supporting files such as `claude.md`, `.cursor/PROTECTED_FILES.md`, `.cursor/rules/**`,
> sprint docs, README files, and historical planning docs may add detail, but they must not
> weaken or contradict this file.
>
> **Repo-truth rule:** Executable code, migrations, current generated types, active configuration,
> and current runtime call sites outrank stale planning documents. When evidence conflicts, verify
> the current branch before making repo-specific claims.

---

## 1. Product Mission

WindowMan is a **Verify-to-Reveal consumer quote-intelligence and broker opportunity system**
for residential window and door projects.

WindowMan is not:

- a generic lead form
- a contractor directory
- a construction contractor
- a law firm
- a government agency
- a fake AI demo
- a second parallel scanner/report stack

### Core product promise

A homeowner can bring WindowMan an existing contractor quote, receive structured quote intelligence,
see a safe preview, verify identity by SMS, unlock the full Truth Report through backend authorization,
and optionally advance into downstream broker / contractor / negotiation / comparison workflows.

### Canonical product spine

```text
lead / intake
→ private quote upload
→ quote metadata
→ scan session
→ scan-quote
→ analysis persistence
→ safe preview
→ SMS OTP
→ backend-authorized full report access
→ full Truth Report reveal
→ broker / contractor / admin / action flows
→ final outcomes
→ market learning
```

Protect this spine above convenience.

---

## 2. Active Sprint Rule

The active sprint is defined by the user's latest explicit approved scope.

Do not treat old sprint-order sections in historical docs as current authority.

For every implementation task:

1. confirm the current branch
2. inspect repo truth
3. identify protected systems
4. state the smallest safe scope
5. modify only approved surfaces
6. verify the result
7. do not expand into adjacent systems without approval

### Scope discipline

Do not turn a bounded feature into a platform rewrite.

Prefer:

```text
small
atomic
testable
reversible
repo-grounded
```

over:

```text
broad
speculative
duplicative
greenfield
```

---

## 3. Non-Negotiable Product and Security Rules

1. **Preview before OTP is allowed. Full report before OTP is forbidden.**

2. **`full_json` must never be fetched, preloaded, logged, cached, stored in browser persistence,
   hidden in the DOM, or otherwise sent to the browser before backend authorization.**

3. **Backend authorization decides report reveal.**
   CSS hiding, disabled buttons, localStorage, sessionStorage, client route guards, and UI state are
   not security.

4. **One verified phone / scan session must not unlock another scan session.**

5. **`analyses` is canonical unless current repo evidence proves otherwise.**
   `quote_analyses` is legacy unless current repo evidence proves otherwise.

6. **Quote files are private assets.**
   Do not make the quotes bucket public. Use controlled backend access / signed access where required.

7. **Do not weaken RLS, grants, tenant isolation, identity integrity, storage policy, or admin authority
   for convenience.**

8. **Do not expose service-role secrets, Twilio secrets, ad-platform secrets, Stripe secrets, or other
   server-only credentials to browser code.**

9. **Do not invent repo architecture.**
   Never invent files, routes, tables, RPCs, Edge Functions, hooks, fields, env vars, scanner states,
   tracking events, or Supabase project targets.

10. **Do not build fake production UI that implies functionality that does not exist.**
    Fixture/dev/visual labs must be clearly labeled and must not masquerade as live intelligence.

11. **Do not bypass Verify-to-Reveal through contractor, admin, partner, dev, sandbox, or visual access.**

12. **Do not automatically deploy, migrate, mutate production data, change secrets, change project
    targets, generate types, or commit/push unless the user explicitly authorizes that action.**

If a requested change conflicts with these rules, stop and surface the conflict.

---

## 4. Repo Truth Before Advice

Before repo-specific implementation advice, verify the relevant:

```text
branch
file
route
Edge Function
table / view / RPC
migration / RLS policy
runtime call path
tracking owner
deployment target
```

When repo context is incomplete:

```text
UNKNOWN
or
NEEDS REPO VERIFICATION
```

Do not fill gaps with plausible architecture.

### Evidence hierarchy

Prefer, in order:

1. current runtime call sites / executable code
2. current migrations and schema definitions
3. current generated types
4. current machine-readable configuration
5. current canonical docs explicitly identified by `docs/START_HERE.md`
6. historical planning docs only as context

Comments and docs may explain intent, but do not override current executable truth.

---

## 5. Scanner Brain Rule

### Permanent separation of responsibilities

```text
Gemini / AI reads.
TypeScript calculates.
Deterministic scoring judges.
Backend persists.
Frontend renders.
```

### AI / extraction layer may

- read PDF/image quote evidence
- classify document type
- extract visible fields
- extract line items
- extract brand / series / dimensions / product evidence where present
- report field/document confidence
- identify missing visible evidence
- identify ambiguity or contradictions
- return strict structured output

### AI / extraction layer must not own

- final grade
- pillar scores
- hard caps
- deterministic financial math
- market percentile calculations
- price fairness judgment
- markup-risk judgment
- negotiation leverage
- report authorization
- final broker qualification
- final market statistics

### Deterministic TypeScript owns

- validation
- normalization where rules are deterministic
- financial metrics
- counts / totals / PPO
- pillar scoring
- hard caps
- red flags
- grades
- deterministic report interpretation
- preview/full payload shaping
- Oracle statistics
- approved confidence calculations
- approved eligibility / fallback logic

### Missing / uncertain evidence

Never fake certainty.

Use explicit states/warnings such as:

```text
needs_better_upload
unreadable_quote
manual_review_pending
insufficient_information
```

where supported by the actual architecture.

---

## 6. Oracle Evolution Protocol — Continuous Intelligence, Human-Gated Evolution

WindowMan may continuously improve **knowledge** from legitimate accumulated evidence (quotes,
analyses, normalized observations, market observations, contractor outcomes, verified sold
outcomes, operator usage patterns, and data-quality history).

**Continual learning does not mean autonomous software mutation.**

### Mandatory root invariants

- **Knowledge may improve; production architecture may not autonomously mutate.**
- **AI interprets evidence; deterministic TypeScript calculates; humans gate structural evolution.**
- **Observation, recommendation, and confidence do not authorize mutations.**
- **Structural evolution requires human review and an approved sprint** before protected systems change.
- AI may draft Evolution Queue recommendations; AI may **never** approve its own recommendation or treat it as permission to mutate protected systems.

AI may not autonomously create/alter schema, RLS, RPCs, Edge Functions, generated types,
scanner/scoring logic, OTP/reveal paths, tracking/CAPI, Stripe, contractor routing, production
routes, deployments, commits, or pushes.

### Detailed canonical policy

Full Oracle evolution doctrine (evolution loop, recommendation contract, normalization rules,
Evolution Queue semantics, self-observation metrics):

```text
docs/oracle/ORACLE_EVOLUTION_PROTOCOL.md
```

Do not implement Oracle or continual-learning changes from supporting or historical docs when they
conflict with that protocol.

---

## 7. Broker Deal Engine Boundaries

WindowMan's Broker Deal Engine is separate from the Scanner Brain and separate from the Oracle.

### Domain separation

```text
Scanner / Truth Engine
= understands one quote

Window Oracle
= understands accumulated market evidence

Broker Opportunity Qualification
= decides whether evidence supports advancing a broker conversation

Broker LOI
= records presented conditional opportunity + homeowner intent

Contractor systems
= fulfillment / routing / field verification

Contractor outcomes
= downstream result / final ground truth
```

Do not collapse these into one table, one function, or one UI state machine.

### Broker business truth

- WindowMan is not the fulfillment contractor.
- Do not guarantee exact final installed price before contractor field verification.
- Contractor independently measures, verifies, discovers conditions, may revise price/scope, or may decline.
- Final construction agreement is between contractor and homeowner.
- A broker LOI is not the final construction contract.
- Payment/lock products must not silently become construction deposits or acceptance evidence.

### Broker qualification

Use:

```text
Broker Opportunity Qualification
```

not construction underwriting.

Commercial policy must be explicit and human-approved.

Do not invent thresholds.

---

## 8. Window Oracle Rules

The Window Oracle is a market-intelligence system, not a browser-side JSON explorer.

### Intended architecture

```text
raw quote / outcome evidence
→ extraction / canonical operational data
→ normalized observations / approved read model
→ server-authorized query / aggregation
→ OracleQueryResponse
→ Oracle UI
```

### Oracle invariants

1. Raw documents remain evidence.
2. Normalized structured facts become queryable intelligence.
3. SQL/RPC/server aggregation interrogates accumulated evidence.
4. React must not arbitrarily mine protected `full_json`.
5. Quoted and verified-sold populations must remain distinct.
6. Every market claim should carry sample size / provenance / date/geography context where available.
7. Median and distributions are generally more informative than average alone.
8. Thin data must not be presented as certainty.
9. Oracle UI must remain data-source agnostic where practical.
10. Synthetic/dev Oracle surfaces must be clearly labeled as synthetic.

### Current fixture/dev truth

A visual/dev Oracle lab may use synthetic observations to validate:

```text
query UX
statistics
confidence presentation
fallback behavior
quoted-vs-sold separation
contractor observations
data-quality presentation
Evolution Engine concepts
```

Fixture success does not prove live market truth.

---

## 9. Protected Systems and Mutation Safety

Canonical protected-path authority:

```text
.cursor/PROTECTED_FILES.md
```

Before editing Tier A–D protected paths, follow the current developer-babysitter / sprint-approval rules.

### Protected by default

Treat these domains as protected even if the specific file list evolves:

- scanner / extraction / scoring
- upload/session bootstrap
- OTP / Twilio
- report-access / reveal
- `full_json`
- private quote storage
- admin authority
- partner/contractor access
- contractor routing
- Supabase schema / migrations / RLS / grants / RPCs / triggers
- service-role paths
- generated DB types
- Supabase project targeting/config
- tracking / GTM / CAPI / vendor routing / dedup
- Stripe / payment infrastructure
- production deployment/env/secrets

### Mutation commands

Do not perform or recommend as routine actions without explicit approval:

```text
supabase db push
supabase db reset
supabase migration up
supabase functions deploy
supabase secrets set
supabase gen types
remote SQL mutation
production data mutation
project target changes
secret/env changes
git commit
git push
force push
```

When a protected mutation is explicitly requested, first state:

```text
target environment
blast radius
rollback path
verification steps
production/staging/local impact
```

Never assume local Supabase is production.

---

## 10. Supabase and Data Architecture Defaults

- Schema, constraints, indexes, and RLS come before major production UI dependencies.
- Use migrations for schema changes.
- Use views/RPCs/Edge Functions where clients should not see raw tables.
- Do not scatter raw Supabase queries through React components.
- Prefer typed services/repositories/hooks.
- Browser-persisted state is a resume hint, never authorization.
- Avoid `any` unless explicitly justified.
- Never show raw database or JSON errors to users.
- Handle loading, retry, offline, unauthorized, locked, and manual-review states.

### Canonical data caution

Do not rely on historical "minimum data model" lists.

Verify current schema before naming a table as canonical.

Known permanent rule:

```text
analyses = canonical analysis lifecycle unless current repo evidence proves otherwise
quote_analyses = legacy unless current repo evidence proves otherwise
```

---

## 11. Tracking / Measurement Rules

Keep two lanes separate.

### Business / conversion lane

```text
trackConversion
→ window.dataLayer
→ GTM
→ approved browser/server vendor routing
```

### Operational telemetry lane

```text
trackEvent
→ internal operational telemetry / diagnostics
```

Do not treat operational telemetry as paid-media truth.

### Rules

- Do not hardcode vendor SDK conversion calls in arbitrary React components.
- Do not post directly to server CAPI endpoints from arbitrary browser components.
- High-value conversion events fire only after backing API/server success.
- Preserve dedup-safe event IDs where required.
- Do not change measurement ownership casually.

Tracking/CAPI/GTM changes require the dedicated protected measurement workflow.

---

## 12. Identity, Sessions, and Authorization

Treat identity types as different concepts.

Examples may include:

```text
lead identity
scan-session identity
auth user identity
contractor/admin identity
event/dedup identity
```

Do not conflate them.

### Authorization rules

- Browser state does not grant protected access.
- Contractor/admin/partner access does not equal homeowner report unlock.
- One verified scan must not unlock another.
- Resume state must not become authorization.
- Public anonymous flow may perform only the intentionally public actions supported by current backend design.

---

## 13. Routes / Dev / Visual / Sandbox Rules

Current route truth must be verified in `src/App.tsx` / route modules before implementation.

### Visual/dev harness rule

Routes such as:

```text
/visual/*
/sandbox/*
```

may exist as UI/fixture/QA surfaces.

They must not become:

- production scanner paths
- OTP bypasses
- paid-media conversion destinations
- public full-report bypasses
- sources of fake live-data claims

No autonomous route mounts to protected routing surfaces.

Use explicit sprint approval where required by `.cursor/PROTECTED_FILES.md`.

---

## 14. UX / CRO Rules

WindowMan should feel:

```text
fast
clear
credible
specific
high-value
mobile-capable
operator-useful
```

Avoid:

```text
generic SaaS sprawl
fake AI theater presented as real analysis
unnecessary choice overload
opaque data claims
weak contrast
over-rounded pill-heavy dashboards where an instrument-like UI is more appropriate
```

### Teaser / reveal

Before verification:

- prove the file was read
- show safe teaser value
- create legitimate curiosity
- never expose enough to reconstruct the full report

After authorization:

- reveal the full report
- give interpretation
- show next steps
- preserve evidence/provenance

CRO never overrides security.

---

## 15. Failure and Uncertainty Handling

Never fake certainty when evidence is weak.

Use explicit safe states supported by the real system.

For AI/market recommendations:

```text
OBSERVED
INFERRED
HYPOTHESIS
UNKNOWN
NEEDS REPO VERIFICATION
NEEDS MORE DATA
```

should be distinguishable where appropriate.

For statistical claims:

- include sample size where available
- distinguish quoted from sold
- distinguish exact cohort from broadened fallback
- surface fallback/broadening
- do not claim market leadership from incomplete observation coverage

---

## 16. Implementation Style

Prefer small atomic changes.

Separate:

```text
data logic
domain logic
authorization
UI
tracking
```

Preserve existing patterns unless clearly harmful.

For any implementation:

1. inspect actual code
2. state affected files
3. identify protected systems
4. make smallest safe change
5. test narrow behavior
6. run typecheck
7. inspect diff
8. list what was intentionally not changed

Do not broad-rewrite a stable system merely to make code aesthetically cleaner.

---

## 17. Definition of Done

A task is not done until relevant checks pass.

At minimum verify:

- [ ] requested objective is actually satisfied
- [ ] no invented repo facts
- [ ] Verify-to-Reveal not weakened
- [ ] no pre-OTP `full_json` leakage
- [ ] no cross-session unlock
- [ ] Scanner Brain separation preserved
- [ ] private quote assets remain private
- [ ] RLS/auth boundaries preserved
- [ ] no accidental tracking changes
- [ ] no accidental Stripe/payment changes
- [ ] no accidental contractor-routing changes
- [ ] no protected mutation without approval
- [ ] typecheck/tests appropriate to scope pass
- [ ] final diff contains only intended files
- [ ] runtime/user experience outside scope is unchanged or intentionally verified

---

## 18. Agent Decision Policy

When uncertain, prefer the option that:

1. protects Verify-to-Reveal
2. protects private data and identity boundaries
3. preserves deterministic truth
4. uses existing architecture before creating new architecture
5. separates market learning from software mutation
6. produces evidence before automation
7. reduces duplication
8. remains reversible
9. keeps the active sprint narrow
10. tells the user what is unknown instead of guessing

### One-line operating principle

> **WindowMan should continuously learn what the market is telling it, while humans remain the authority over how the software itself evolves.**

---

## 19. Canonical References

Start with:

```text
docs/START_HERE.md
```

Primary authorities:

```text
AGENTS.md
.cursor/PROTECTED_FILES.md
docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md
docs/ops/SUPABASE_FUNCTION_MANIFEST.md
docs/ops/SUPABASE_TARGETING.md
docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md
docs/oracle/ORACLE_EVOLUTION_PROTOCOL.md
```

Use `docs/ops/DOC_STATUS_REGISTRY.md` before trusting historical planning docs.

If a historical doc conflicts with current canonical policy or executable repo truth, do not implement from the stale doc.

## Canonical Checkout and Parallel Worktree Policy

### Canonical source of truth

- `C:\Projects\wm-mvp-github-clean` is the canonical local checkout.
- `forensic_report_v2` is the integration branch.
- Pull requests target `forensic_report_v2` unless the user explicitly names another target.
- Do not use stale `main` as the starting or target branch.

### Fail-closed session preflight

Every implementation prompt must name:

```text
assigned absolute worktree
expected branch
expected base
exact allowed paths
exact protected paths
```

Set the assigned worktree as the explicit working directory for every command. A prior shell `cd`
does not authorize later commands to run from another directory.

Before the first edit, run and report:

```powershell
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short --branch --untracked-files=all
git worktree list --porcelain
```

Abort without editing if:

- the resolved root or active branch differs from the prompt;
- any staged, modified, deleted, renamed, or untracked path is unexplained;
- the expected branch is already assigned to another worktree;
- another Codex task, Cursor window, or writer is using the same physical folder;
- the requested starting point cannot be verified from current repository evidence.

### When only one coding task is active

- Use the canonical local checkout.
- Before editing, verify the folder, active branch, uncommitted changes, upstream, and parity with the latest `origin/forensic_report_v2`.
- Create a short-lived `codex/<feature-name>` branch from the latest `origin/forensic_report_v2`.
- Do not create another worktree merely because the user opened another chat.

### When coding tasks will run simultaneously

If the user says "work on this separately," "create another tree," "do this while the other task runs," "start a parallel task," or otherwise clearly requests simultaneous work, that request is explicit authorization to create a Codex-managed worktree.

For parallel work:

1. Create a new Codex task using the desktop app's managed **Worktree** environment. Do not ask the user to run Git or PowerShell commands.
2. Start the worktree from the latest fetched `origin/forensic_report_v2`, unless the user explicitly names another starting point.
3. Do not import uncommitted changes from the canonical checkout unless the user explicitly says those changes belong to the new task.
4. Assign one coding task and one active writer to each physical folder.
5. Do not let two Codex tasks, Cursor, or any combination of agents edit the same physical folder simultaneously.
6. Do not reuse an unrelated existing worktree.
7. Do not modify the canonical checkout from a task assigned to a worktree.
8. Do not pre-create empty worktrees for hypothetical tasks. Create one only after a concrete independent workstream is defined.
9. Give each workstream one exact, unique `codex/<specific-task-slug>` branch. Verify that the branch name is not already present locally or on the remote.
10. Before the first edit, report in plain language:
   - task name
   - worktree location
   - starting branch and commit
   - whether the worktree is clean
11. A Codex-managed worktree may initially use a detached checkout. Before committing, create the task's one focused branch in that worktree.
12. Keep that task's files, tests, preview server, commits, push, and pull request inside its assigned worktree.
13. If Cursor will edit the worktree, open that exact worktree folder in a separate Cursor window. Do not point Cursor at the canonical folder while another writer is using it.
14. Keep the task pinned until its work is committed, pushed, and safely merged.

### Sequential work inside one workstream

- Dependent phases that will ship in one eventual pull request reuse the same worktree and the same branch.
- Record each phase as a separate coherent commit; do not create one branch per phase merely for bookkeeping.
- Switch branches inside a worktree only when the user explicitly requests a different review or integration topology and the worktree is clean.
- Branches alone do not isolate simultaneous writers. If two tasks will run at the same time, they require separate physical worktrees.

### Active Power Demo V2 reservation

Until the Power Demo V2 work is merged and verified, it owns:

```text
worktree: C:\Users\Dell\.codex\worktrees\power-demo-v2-scaffold\wm-mvp-github-clean
branch: codex/power-demo-v2-scaffold
paths: src/components/power-demo-v2/**
       src/pages/PowerDemoV2Page*
       design-qa.md
```

- Keep all dependent V2 phases on `codex/power-demo-v2-scaffold` as atomic commits for one eventual PR.
- Do not rerun the historical freeze sequence. The frozen checkpoint is commit `c9e62687`; verify current state before relying on that dated SHA.
- Reserve the `codex/power-demo-v2-*` namespace for this workstream. Other simultaneous tasks use distinct `codex/<task-slug>` names.
- Treat `src/App.tsx`, `src/components/PowerToolDemo.tsx`, and `src/components/power-demo/**` as shared coordination surfaces.
- If another workstream needs a shared coordination surface, land that work in `forensic_report_v2` first, then rebase V2 onto the updated base.
- Do not merge or cherry-pick sibling feature branches directly into the V2 branch.

### Local environment and previews

- Use the repository-approved local development environment.
- Use `npm run dev:all` when the full local Vite, Supabase, and Edge Function flow is required.
- A disconnected UI-only preview may prove appearance and interaction, but it must not be presented as proof of persistence, identity, upload, OTP, or reveal behavior.
- Do not commit, print, or expose secrets.
- Do not copy `.env.local` or `supabase/functions/.env` into another checkout.
- If a worktree requires the approved local environment, access it through the existing safe local setup without displaying or duplicating secret values.

### Dirty-folder handling

- "Dirty" means the folder contains uncommitted or untracked files; it does not mean the work is broken.
- A dirty canonical checkout is not permission to delete, reset, stash, move, or overwrite its changes.
- If unrelated work is already present, preserve it and place the newer simultaneous task in an authorized managed worktree.
- If two writers are discovered in the same folder, stop the newer writer before further edits and move the newer task to a separate managed worktree.
- Never use `git stash`, `git reset --hard`, `git clean -f`, `git clean -fd`, `git restore` to discard work, or `git checkout -- <path>` as an isolation shortcut.
- Never use `git add .`, `git add -A`, wildcards, or directory-wide staging.

### Exact staging and commit hygiene

Before every commit:

1. Run `git status --short --branch --untracked-files=all` and classify every dirty path.
2. Stage individually reviewed files with `git add -- <file-1> <file-2>`.
3. Verify `git diff --cached --name-status`, `git diff --cached --stat`, and `git diff --cached --check`.
4. If the staged set differs from the approved list, unstage safely and stop for review. Do not reset or discard file content.
5. Run the task's focused tests, typecheck, build, and protected-path diff review before delivery.

### Integrating parallel work

Independent workstreams integrate through their own PRs into `forensic_report_v2`. A long-running feature branch then updates from the integration branch by rebasing; it does not absorb sibling branches directly.

Before rebasing:

```powershell
git status --short --branch --untracked-files=all
git fetch origin forensic_report_v2
git rev-parse HEAD
git rev-parse origin/forensic_report_v2
git merge-base HEAD origin/forensic_report_v2
git rebase origin/forensic_report_v2
```

- The worktree must be clean and have only one active writer.
- Stop on conflicts involving shared or protected files; do not guess or auto-resolve them.
- After the rebase, rerun focused tests, the complete test command, typecheck, production build, and final diff review.
- Rebasing synchronizes a feature branch with its base. The eventual PR still targets `forensic_report_v2` and uses the repository's approved PR merge strategy.

If the branch was already pushed, capture its current remote SHA before the rebase and update it only with an explicit lease:

```powershell
$Branch = "codex/<feature-name>"
$RemoteLine = git ls-remote --heads origin "refs/heads/$Branch"
if (-not $RemoteLine) { throw "Remote branch not found: $Branch" }
$RemoteBefore = ($RemoteLine -split "\s+")[0]

# Perform the clean rebase and verification first.

git push `
  --force-with-lease="refs/heads/${Branch}:$RemoteBefore" `
  origin `
  "HEAD:refs/heads/$Branch"
```

- Never use bare `--force`.
- If the explicit lease fails, stop because the remote branch changed after it was inspected.
- This explicit lease is required when a narrow fetch refspec means the feature branch has no usable local remote-tracking ref.

### Finishing a worktree task

- Verify the intended files, focused tests, typecheck, and final diff.
- Commit and push only the task's intended files.
- Open a focused pull request targeting `forensic_report_v2`.
- Do not merge, deploy, delete a branch, delete a worktree, or change production unless the user explicitly requests it.
- Keep the worktree until its PR is merged and the requested verification is complete; then deliberately archive or remove it instead of preserving it indefinitely.
- After a merge, report:
  - pull request number
  - permanent merge commit
  - target branch
  - production verification performed
  - whether the task and its managed worktree can now be archived

## Cursor Cloud specific instructions

- Install dependencies with `npm ci`. `predev` and `prebuild` call `bunx tsx`. Bun is available as `bun`, and the Edge Function typecheck workflow pins Deno `v1.46.3`.
- Local development uses the Supabase CLI stack in Docker (`npx supabase start`). Point `VITE_SUPABASE_URL` at `http://127.0.0.1:54321`. The Vite app is `npm run dev` on port 8080.
- `supabase/config.toml` does not enable the database pooler or image transformation, so `supabase_pooler` and `supabase_imgproxy` stay stopped. The rest of the local stack should be running.
- If `supabase start` restores an empty database from a backup taken before migrations finished, run `npx supabase stop --no-backup` and start again. That flag deletes local volumes only.
- Do not point local dev at a hosted Supabase project. Do not commit `.env.local` or `supabase/functions/.env`. Generate those from `npx supabase status -o env` after the local stack is up.
