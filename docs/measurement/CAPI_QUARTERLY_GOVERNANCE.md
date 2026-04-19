# CAPI Quarterly Governance

> **Read-first:** [`CAPI_OPERATOR_HANDOFF_PACKET.md`](./CAPI_OPERATOR_HANDOFF_PACKET.md). This doc governs the docs themselves — not the runtime system.

---

## 1. Purpose

The Meta CAPI control plane has accumulated a layered set of operational documents (onboarding, validation, go-live, watchtower, recovery, fleet view, weekly review, monthly audit, handoff packet). Without a recurring governance pass, this corpus tends to:

- duplicate "source of truth" guidance across files
- preserve historical/intermediate docs as if they were live instructions
- drift away from the actual code in `_shared/capiRouting.ts`, `capi-event/`, and `admin-data/`
- quietly reintroduce forbidden patterns (browser conversions, multi-pixel browser routing, double-hashing, OTP/reveal coupling)

This quarterly process exists to **prune, re-anchor, and archive** — not to rewrite. Run it once per quarter so the doc tree stays a clean operator surface, not a forensic archive.

---

## 2. Canonical doc hierarchy

Every CAPI/measurement doc belongs to exactly one tier. If a doc doesn't fit, archive it.

### Tier 1 — First-read (must always be current)

| Doc | Role |
|---|---|
| [`CAPI_OPERATOR_HANDOFF_PACKET.md`](./CAPI_OPERATOR_HANDOFF_PACKET.md) | Single canonical entry point — sequences all other docs |
| [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) | Load-bearing rules: browser scope, server ownership, match quality |

### Tier 2 — Operator workflow (lifecycle order)

| Doc | Stage |
|---|---|
| [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md) | New operator + token rotation |
| [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) | Routing precedence + client config |
| [`CAPI_ROUTING_VALIDATION.md`](./CAPI_ROUTING_VALIDATION.md) | Preview + smoke-send |
| [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md) | Promotion decision |
| [`CAPI_POST_LAUNCH_WATCHTOWER.md`](./CAPI_POST_LAUNCH_WATCHTOWER.md) | T+0 → T+72h |

### Tier 3 — Diagnostics / recovery / cadence

| Doc | Role |
|---|---|
| [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md) | Active incident triage |
| [`CAPI_FLEET_HEALTH_VIEW.md`](./CAPI_FLEET_HEALTH_VIEW.md) | Cross-client view |
| [`CAPI_WEEKLY_OPERATOR_REVIEW.md`](./CAPI_WEEKLY_OPERATOR_REVIEW.md) | Weekly cadence |
| [`CAPI_MONTHLY_CONTROL_PLANE_AUDIT.md`](./CAPI_MONTHLY_CONTROL_PLANE_AUDIT.md) | Monthly governance of the system |
| `CAPI_QUARTERLY_GOVERNANCE.md` (this doc) | Quarterly governance of the docs |
| [`MEASUREMENT_DISCREPANCY_DECISION_TREE.md`](./MEASUREMENT_DISCREPANCY_DECISION_TREE.md) | Number mismatches |

### Tier 4 — Reference

Anything purely informational, schema-level, or one-off. Currently none — flag any new doc that wants to live here as a candidate for inlining into Tier 1–3.

### Tier 5 — Archive candidates (review every quarter)

These docs predate or partially overlap with the canonical tiers. They are not deleted, but they should be marked clearly so operators know they are not first-read:

| Doc | Status to evaluate | Suggested action |
|---|---|---|
| [`BROWSER_META_DECOUPLING_COMPLETE.md`](./BROWSER_META_DECOUPLING_COMPLETE.md) | Historical reconciliation note (already cited as historical) | Keep, mark archived — do not link from Tier 1–3 |
| [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md) | Pre-CAPI-split operator guidance | Confirm coverage exists in Tier 2 docs; if so, archive |
| [`MEASUREMENT_DEPLOYMENT_CHECKLIST.md`](./MEASUREMENT_DEPLOYMENT_CHECKLIST.md) | Likely superseded by `CAPI_CLIENT_GO_LIVE_GATE.md` | Confirm overlap; archive if redundant |

> **Archive marking convention:** add a single block at the top of an archived doc:
>
> ```md
> > **ARCHIVED — superseded by [`<canonical-doc>`](./<canonical-doc>.md). Kept for historical reference. Do not use as live guidance.**
> ```

---

## 3. Quarterly review checklist

Run on the first business day of each quarter. Owner: measurement architect. Expected duration: 60–90 min.

### 3.1 Inventory

- [ ] List every file in `docs/measurement/` (and `docs/operations/` if applicable)
- [ ] Assign each to a tier (1–5) using §2
- [ ] Flag anything that doesn't fit a tier — propose archive or merge

### 3.2 Canonical accuracy check

For each Tier 1–3 doc, verify it still matches the code:

- [ ] Tier 1: rules in `CANONICAL_MEASUREMENT_ARCHITECTURE.md` still reflect `capi-event/index.ts` (hashing, IP/UA fallback, `isSha256Hex` guard) and `_shared/capiRouting.ts` (precedence)
- [ ] Tier 2: every admin action referenced (`create_meta_client_config`, `set_meta_client_active`, `preview_meta_route`, `smoke_send_meta_event`, `diagnose_token_health`) still exists in `supabase/functions/admin-data/index.ts` with the documented payload shape
- [ ] Tier 3: every reporting action (`summarize_meta_fleet_health`) still exists with the documented response shape
- [ ] Handoff packet links resolve and target docs still exist

### 3.3 Forbidden-pattern sweep

For each Tier 1–3 doc, confirm it does **not**:

- [ ] suggest broadening browser Meta beyond `init` + `PageView`
- [ ] suggest browser-side conversion ownership
- [ ] suggest browser-side multi-pixel routing or client pixel selection
- [ ] suggest holding Meta access tokens or CAPI tokens in browser code
- [ ] weaken any §3.2 match-quality rule from `CANONICAL_MEASUREMENT_ARCHITECTURE.md`
- [ ] introduce coupling to OTP, reveal, or Twilio

If any of these appear, log as a sprint escalation — do **not** silently fix in this pass.

### 3.4 Duplication check

- [ ] No two Tier 1–3 docs claim to be "the source of truth" for the same topic
- [ ] No Tier 5 doc is being linked from a Tier 1–3 doc as live guidance
- [ ] No two docs describe the same admin action with different payloads

### 3.5 Output

Produce a quarterly governance log entry (template in §6) and act on archive/escalation findings within 30 days.

---

## 4. Archive rules

| Situation | Action |
|---|---|
| Doc is fully covered by a newer canonical doc | **Archive** with §2 marker pointing to canonical doc |
| Doc is partially covered + adds historical context | **Archive** — keep as reference, do not delete |
| Doc has unique still-relevant content | **Merge** the unique content into the right canonical doc, then archive the original |
| Two docs disagree | **Escalate** — do not pick a winner unilaterally; open a sprint to reconcile |
| Doc is intermediate / interim (e.g., a migration log) | **Archive** as soon as the migration is complete |
| Doc is empty / stub | **Delete** (only if confirmed no inbound links) |
| Doc references removed code paths | **Update or archive** — never leave broken instructions live |

**Never delete** without first archiving for one full quarter — historical traceability matters more than tidiness.

---

## 5. Doc-sprawl danger signs

Watch for these patterns. Each is a trigger to act in this quarterly pass:

- Two docs both labeled "operator runbook" or "first-read"
- Operator steps that reference admin actions that no longer exist
- Instructions that route through the browser for anything beyond `PageView`
- Instructions that bypass the canonical mapper or call `capi-event` directly from the browser
- Docs that quietly add new health states, new routing tiers, or new event names not present in code
- Docs that reference protected files (`PostScanReportSwitcher.tsx`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`) as editable
- Multiple docs describing token rotation with different procedures
- New docs created without a tier assignment

---

## 6. Quarterly governance log template

Append to internal ops log:

```
## CAPI Quarterly Governance — YYYY-Q[1-4]
Owner: <name>
Date: YYYY-MM-DD
Doc count this quarter: N (delta vs last quarter: +/- N)

Tier assignments:
  Tier 1 (first-read):           [files]
  Tier 2 (workflow):             [files]
  Tier 3 (diagnostics/cadence):  [files]
  Tier 4 (reference):            [files]
  Tier 5 (archive candidates):   [files]

Canonical accuracy issues found:    [doc — issue — action]
Forbidden-pattern findings:         [doc — pattern — sprint ticket]
Duplication findings:               [docs — overlap — action]

Archived this quarter:              [file → marker added → supersedes link]
Merged this quarter:                [from → into → diff summary]
Escalated to sprint:                [item — ticket]

Carry-forward:                      [item — owner — due]
Next governance pass: YYYY-MM-DD
```

---

## 7. What this pass does NOT do

- ❌ Does not rewrite canonical docs (escalate to a sprint instead)
- ❌ Does not change runtime code, tests, or workflows
- ❌ Does not change browser Meta scope, server ownership, routing precedence, or event taxonomy
- ❌ Does not delete docs in the same quarter they are first archived
- ❌ Does not unilaterally reconcile contradictions between two docs

---

## 8. References

- [`CAPI_OPERATOR_HANDOFF_PACKET.md`](./CAPI_OPERATOR_HANDOFF_PACKET.md) — canonical entry point
- [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) — load-bearing rules
- [`CAPI_MONTHLY_CONTROL_PLANE_AUDIT.md`](./CAPI_MONTHLY_CONTROL_PLANE_AUDIT.md) — monthly system audit (sibling cadence)
