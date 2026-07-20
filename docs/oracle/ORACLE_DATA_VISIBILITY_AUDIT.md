# Oracle Data Visibility Audit — Phase 0

**Status:** Planning / architecture (no runtime impact)  
**Date:** 2026-07-20  
**Purpose:** Inventory what WindowMan can honestly display for market intelligence **today**, and classify what is still nested, free-text, or missing — before any Oracle live data wiring.

Related product law: Oracle = market evidence; Broker Opportunity Qualification = decision consumer; Scanner = extraction only.

---

## A. What we can display today (project-level)

| Metric | Source | Queryability |
|--------|--------|--------------|
| Analysis count / status / document_type | `analyses.analysis_status`, `document_type` | Structured columns |
| Quote total | `analyses.full_json.derived_metrics.totals.contract_total` | Nested JSONB (deterministic) |
| Opening count | `derived_metrics.counts.total_openings`; also `wm_quote_facts.opening_count` | Nested + structured |
| Window / door counts | `derived_metrics.counts.window_openings` / `door_openings` | Nested JSONB |
| PPO (canonical) | See §A.1 | Nested JSONB |
| County | `leads.county`; also `wm_quote_facts.county` | Structured |
| ZIP | `leads.zip` only (**not** on `wm_quote_facts`) | Structured on leads |
| Project type | `leads.project_type` | Structured |
| Document type | `wm_quote_facts.document_type` / `analyses.document_type` | Structured |
| Trust score / anomaly / index flags | `wm_quote_facts` (`trust_score`, `anomaly_status`, `approved_for_index`, `manual_review_required`, `duplicate_suspected`) | Structured; **optional** — may be absent for some analyses |
| Brand coverage % | `derived_metrics.coverage.brand_coverage_pct` | Nested aggregate only |
| Brand / series / dimensions (raw) | `full_json.extraction.line_items[]` | Nested, unnormalized strings |
| Quoted contractor name | `extraction.contractor_name` | Free-text in JSON |
| Sold final value / beat price | `contractor_outcomes.final_value_cents`, `did_beat_price`, `outcome_verified` | Structured |
| County benchmarks (seed/cron) | `county_benchmarks` via `refresh-benchmarks` | Exists in code; **NOT_DEPLOYED / MISSING_ON_STAGING** per function manifest |

### A.1 Canonical PPO precedence (locked)

```text
Primary:   derived_metrics.per_opening.installed_price_per_opening
Fallback:  derived_metrics.per_opening.contract_price_per_opening
Reject:    null, <= 0, or > 10000 (same sanity bound as refresh-benchmarks)
Cross-check: wm_quote_facts.price_per_opening only when derived_metrics absent
```

Anchors:

- [`supabase/functions/_shared/metrics.ts`](../../supabase/functions/_shared/metrics.ts) — `computeDerivedMetrics`
- [`supabase/functions/scan-quote/reportCompiler.ts`](../../supabase/functions/scan-quote/reportCompiler.ts) — prefers installed PPO
- [`supabase/functions/refresh-benchmarks/index.ts`](../../supabase/functions/refresh-benchmarks/index.ts) — installed ?? contract, bound ≤ 10000

### A.2 Admin read architecture today

| Surface | Transport | Scope |
|---------|-----------|-------|
| Operator Reporting | `adminDataService` → `admin-data` | Leads / opps / routes / contractors (CRM funnel) |
| Data Quality | Same + in-page leads | CRM field integrity — **not** extraction/market coverage |
| Shared Market | Mostly placeholder / manual | Not Oracle |
| Partner outcome rollup | `fetch_partner_outcome_rollup` | `contractor_outcomes` aggregates |
| Lead evidence | `fetch_lead_evidence` | Analyses **without** `full_json` |

**Gap:** No `admin-data` action reads `wm_quote_facts` or aggregates `derived_metrics` for market intelligence. Browser must not mine `full_json`.

---

## B. Dimension classification matrix

Classification legend:

| Label | Meaning |
|-------|---------|
| RELIABLY STRUCTURED | Column or deterministic project-level metric suitable for SQL filters |
| EXTRACTED BUT NESTED | Present in extraction / `derived_metrics` JSON, not first-class SQL |
| FREE-TEXT ONLY | String without stable enum / alias control |
| INCONSISTENT | Partial signal; spelling or semantics vary |
| NOT CURRENTLY EXTRACTED | No scanner field |
| UNKNOWN | Needs staging sample audit |

| Dimension | Classification | Notes |
|-----------|----------------|-------|
| ZIP | RELIABLY STRUCTURED | `leads.zip`; coverage TBD on staging |
| County | RELIABLY STRUCTURED | `leads.county` / `wm_quote_facts.county` |
| Project type | RELIABLY STRUCTURED | `leads.project_type` |
| Opening count | RELIABLY STRUCTURED / nested | Facts column + `derived_metrics.counts` |
| Quote total | EXTRACTED BUT NESTED | `derived_metrics.totals.contract_total` |
| Quoted PPO | EXTRACTED BUT NESTED | Canonical path above |
| Document type | RELIABLY STRUCTURED | analyses / facts |
| Trust / approved_for_index | RELIABLY STRUCTURED | `wm_quote_facts` (optional row) |
| Manual review / duplicate | RELIABLY STRUCTURED | `wm_quote_facts` |
| Brand | EXTRACTED BUT NESTED + INCONSISTENT | `line_items[].brand` — alias fragmentation risk |
| Series | EXTRACTED BUT NESTED + INCONSISTENT | `line_items[].series` |
| Dimensions (raw) | EXTRACTED BUT NESTED + FREE-TEXT ONLY | Not normalized W×H; prompt preserves print form |
| Width / height integers | NOT CURRENTLY EXTRACTED | Phase 2 normalization |
| Window / door type (per opening) | INCONSISTENT | Bucket counts yes; per-opening type enum no |
| Impact / non-impact | INCONSISTENT | Regex / glass hints only |
| Glass | EXTRACTED BUT NESTED | `glass_makeup_type` + flags on line items |
| Frame | NOT CURRENTLY EXTRACTED | SIGNAL_CONTAINER_MAP #17 |
| Product approval / NOA | EXTRACTED BUT NESTED | `line_items[].noa_number` |
| Quoted contractor | FREE-TEXT ONLY | `extraction.contractor_name` |
| Sold contractor | RELIABLY STRUCTURED | `contractor_outcomes.contractor_id` → `contractors` |
| Sold unit / project PPO | RELIABLY STRUCTURED (derived) | `final_value_cents / opening_count` when comparable |
| Quoted unit price (per opening line) | EXTRACTED BUT NESTED | `line_items[].unit_price` — not market grain yet |

Seeded from [`docs/report/SIGNAL_CONTAINER_MAP.md`](../report/SIGNAL_CONTAINER_MAP.md).

---

## C. Join paths and dormant surfaces

### C.1 Quote → sold join (canonical)

```text
analyses.id
  ← contractor_opportunities.analysis_id
  ← contractor_outcomes.opportunity_id
```

There is **no** `analysis_id` on `contractor_outcomes`. Alternate paths (`route_id`, `billable_intro_id`) are secondary until cardinality is verified on staging.

Verified sold eligibility must use `outcome_verified` (and integrity fields) — not mere `disposition_state = sold_closed`.

### C.2 Geography join for quoted cohorts

```text
analyses.lead_id → leads(zip, county, project_type)
```

ZIP-first product UX depends on `leads.zip` completeness, not `wm_quote_facts`.

### C.3 Dormant / unreliable for Oracle v0

| Surface | Status |
|---------|--------|
| `wm_pricing_index_snapshots` | Table exists; **no application writers/readers found** |
| `refresh-benchmarks` → `county_benchmarks` | Code exists; manifest **NOT_DEPLOYED / MISSING_ON_STAGING** |
| Opening-level SQL tables | **Do not create yet** — await extraction reliability proof |

---

## D. Data Lab v0 hosting recommendation (future sprint)

**Do not** create `/admin/oracle` in the current safe-build sprint.

| Option | Recommendation |
|--------|----------------|
| New AdminDashboard tab | Preferred long-term; requires `SPRINT APPROVAL` for `App.tsx` / tab registry |
| Sub-panel under `needs-review` or `engine` | Acceptable temporary host |
| Reuse `data-quality` tab as-is | **No** — CRM integrity ≠ extraction/market microscope |
| Browser direct `full_json` | **Forbidden** |

Future live reads: new **read-only** `admin-data` actions (service role), aggregate-safe payloads, no PII.

Fixture-only UI for this sprint lives under `src/components/admin/oracle/` **unmounted**.

---

## E. Three-system separation (locked)

1. **Scanner / Extraction** — What does this document say? (`scan-quote`)
2. **Window Oracle** — What has WindowMan observed? (this track)
3. **Broker Opportunity Qualification** — Should we advance this homeowner? (`brokerOpportunityQualification.ts`)

Broker qualification must eventually **consume** Oracle `marketEvidence`; it must not compute market aggregates.

---

## F. Verification checklist before live Oracle wiring

- [x] Audit existing admin query surfaces (service → `admin-data`)
- [x] Document canonical PPO precedence
- [x] Document ZIP ownership (`leads.zip`)
- [x] Document outcome → analysis join path
- [x] Inventory `wm_pricing_index_snapshots` writers (none in app)
- [x] Note `refresh-benchmarks` deploy status (missing on staging)
- [ ] Verify `wm_quote_facts` production/staging coverage % (needs SQL on target env)
- [ ] Verify `outcome_verified` yield on staging
- [ ] Human-approve confidence thresholds before production policy
- [ ] Human-approve contractor pricing-tier labels
- [ ] Confirm no browser raw `full_json` market mining
- [ ] Confirm no new tables required for project-level v0

---

## G. Recommended unprotected implementation folders (this sprint)

| Path | Role |
|------|------|
| `src/lib/windowOracle/` | Pure intelligence core (Vitest) |
| `src/components/admin/oracle/` | Fixture-only UI (unmounted) |
| `docs/oracle/` | Planning docs |

At a future approved integration sprint, port/sync core to `supabase/functions/_shared/windowOracle/` for Edge consumption (same dual-copy pattern as tracking mappers).
