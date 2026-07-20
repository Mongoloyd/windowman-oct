# Scanner Model Governance — WindowMan.PRO

**Last updated:** 2026-05-26  
**Scope:** Gemini extraction model used by `scan-quote` only. Scoring, flagging, and report compilation remain deterministic TypeScript — never AI-generated.  
**Related:** [`SUPABASE_TARGETING.md`](./SUPABASE_TARGETING.md), [`SUPABASE_ENVIRONMENT_REGISTRY.md`](./SUPABASE_ENVIRONMENT_REGISTRY.md), [`SUPABASE_FUNCTION_MANIFEST.md`](./SUPABASE_FUNCTION_MANIFEST.md), `supabase/functions/_shared/scannerConfig.ts`

> **Operational role note:** This runbook uses legacy labels **staging** / **production** in phase headings. Per the environment registry: **`zgsofkgddpcntdvpckdq` = LIVE_ACTIVE** (current live DB; default Forensic V2 target). **`wkrcyxcnzhwjtdpmfpaf` = LEGACY_PARENT** (forbidden unless explicitly authorized). `scripts/supabase/assert-staging.ps1` asserts LIVE_ACTIVE, not a disposable staging environment.

---

## 1. Executive Summary

WindowMan's Scanner Brain calls Google Gemini for **extraction only**. The active model ID is **runtime configuration** stored in Supabase secrets (`GEMINI_SCAN_MODEL`), not in Git. A Gemini model rename, deprecation, or silent format drift can break extraction without any code deploy — as happened when the preview model `gemini-3.1-flash-lite-preview` was sunset in favor of the stable ID `gemini-3.1-flash-lite`.

This document defines the **operator-only** process for changing, validating, and rolling back the scanner model. No developer or AI agent may change `GEMINI_SCAN_MODEL` in production without completing the local harness test and the 3-quote browser regression described below.

**North star:** Model changes are controlled, testable, documented, and reversible. Logs — not browser UI alone — prove the scanner is healthy.

---

## 2. Current Scanner Model Contract

### Authorized runtime model (production + staging)

| Field | Value |
|-------|-------|
| **Active model ID** | `gemini-3.1-flash-lite` |
| **Configuration key** | `GEMINI_SCAN_MODEL` (Supabase Edge Function secret) |
| **Read path** | `getScannerRuntimeConfig().geminiModel` in `supabase/functions/_shared/scannerConfig.ts` |
| **URL builder** | `buildGeminiUrl(model, apiKey)` → `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| **Companion secret** | `GEMINI_API_KEY` (required; shared with other Gemini functions — see manifest) |

### Git fallback default (not the production contract)

The repo ships a **code fallback** when `GEMINI_SCAN_MODEL` is unset:

```text
DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite-preview"
```

This value exists in `scannerConfig.ts` and is commented in `.env.example`. It is **not** the authorized production model. Operators must set `GEMINI_SCAN_MODEL=gemini-3.1-flash-lite` in Supabase secrets so runtime behavior does not depend on a deprecated preview ID.

### Why the model value is not committed to Git

| Reason | Detail |
|--------|--------|
| **Runtime override without redeploy** | `scan-quote` reads `Deno.env.get("GEMINI_SCAN_MODEL")` at invocation time. Changing the secret updates behavior without merging code or redeploying functions. |
| **Secret hygiene** | Model choice is paired with `GEMINI_API_KEY` in the same secret store. API keys must never enter Git; keeping the model in the same layer avoids split-brain config. |
| **Environment isolation** | LIVE_ACTIVE and LEGACY_PARENT can diverge temporarily during validation (`zgsofkgddpcntdvpckdq` vs `wkrcyxcnzhwjtdpmfpaf`) without branch churn. |
| **Incident response speed** | Rollback is a secret revert, not a hotfix deploy. |

**Rule:** Treat `GEMINI_SCAN_MODEL` as **runtime config**, not Git config. `.env.example` documents the variable name and an example value only — never the live production choice.

### Fallback model policy

1. **Primary:** Value of Supabase secret `GEMINI_SCAN_MODEL` when non-empty after trim.
2. **Code fallback:** `gemini-3.1-flash-lite-preview` from `DEFAULT_GEMINI_MODEL` in `scannerConfig.ts` if the secret is missing or empty.
3. **Operator expectation:** Fallback must not be relied upon in production. If `secrets list` shows `GEMINI_SCAN_MODEL` absent, treat the environment as **misconfigured** until the operator sets the authorized model.
4. **Validation fallback:** During local harness runs, export `GEMINI_SCAN_MODEL` explicitly to the candidate model under test. Do not assume the harness default (`gemini-2.5-flash` in the diagnostic script's internal fallback) matches production.

### Who may change the model

| Role | Allowed |
|------|---------|
| **Operator (human)** | Yes — after checklist, harness pass, staging validation, and explicit production approval |
| **Developers / AI agents** | No — unless acting as operator with explicit sprint approval for a model migration |
| **Automated CI/CD** | No — secret rotation is manual and deliberate |

### Related runtime knobs (change separately, never with model + prompt together)

| Secret | Default (code) | Purpose |
|--------|----------------|---------|
| `GEMINI_SCAN_TIMEOUT_MS` | `15000` | Hard abort for Gemini fetch |
| `GEMINI_SCAN_MAX_OUTPUT_TOKENS` | `8192` | Output token budget |
| `SCAN_STALE_PROCESSING_MINUTES` | `3` | Stale session recovery |
| `SCAN_MAX_FILE_BYTES` | `15728640` (15 MB) | Upload size cap |

---

## 3. Model Change Checklist

Complete **in order**. Do not skip steps.

### Phase A — Before any secret change

- [ ] Confirm **why** the model is changing (deprecation notice, cost, latency, quality experiment).
- [ ] Record current secret presence: `supabase secrets list --project-ref <project-ref>` (staging first).
- [ ] Note current authorized model: `gemini-3.1-flash-lite`.
- [ ] Ensure **no concurrent** changes to `GEMINI_EXTRACTION_PROMPT` in `scan-quote/index.ts`.
- [ ] Ensure **no concurrent** scanner code edits (parser, scoring, validation).
- [ ] Identify **3 quote fixtures** for regression (see §5): one clean PDF/image, one dense multi-page quote, one marginal/low-quality scan.

### Phase B — Local harness (mandatory)

- [ ] `GEMINI_API_KEY` available locally (never commit).
- [ ] Run harness against **candidate model** with `GEMINI_SCAN_MODEL` set (§4).
- [ ] All three fixtures: `normalized_parse_status` = `NORMALIZED_JSON_PARSE_OK`.
- [ ] No `finishReason` = `MAX_TOKENS` on standard quotes.
- [ ] Token counts within expected range (no runaway `candidatesTokenCount`).

### Phase C — Staging secret update

- [ ] Run `scripts/supabase/assert-staging.ps1` (or verify linked ref is `zgsofkgddpcntdvpckdq`).
- [ ] Set secret on **staging only** first:

  ```powershell
  supabase secrets set GEMINI_SCAN_MODEL=gemini-3.1-flash-lite --project-ref zgsofkgddpcntdvpckdq
  ```

- [ ] Verify: `supabase secrets list --project-ref zgsofkgddpcntdvpckdq` shows `GEMINI_SCAN_MODEL` (digest only — never paste values).
- [ ] **No redeploy required** — secret is read at runtime.

### Phase D — Staging browser regression (3 quotes)

- [ ] Complete §5 checklist on staging frontend (`VITE_SUPABASE_URL` → `zgsofkgddpcntdvpckdq`).
- [ ] Inspect Edge Function logs for all three scans (§7 log checks).

### Phase E — LEGACY_PARENT sync (explicit approval only; not routine live rollout)

LIVE_ACTIVE (`zgsofkgddpcntdvpckdq`) receives current leads. Phases C–D on that ref **are** the live model-change path unless product policy explicitly requires a separate legacy-parent sync.

- [ ] Operator sign-off after LIVE_ACTIVE pass.
- [ ] Only if explicitly authorized — set LEGACY_PARENT secret (do not treat as current live):

  ```powershell
  supabase secrets set GEMINI_SCAN_MODEL=gemini-3.1-flash-lite --project-ref wkrcyxcnzhwjtdpmfpaf
  ```

- [ ] Repeat §5 smoke only if legacy-parent sync was authorized (1 quote minimum).
- [ ] Update this document's "Last updated" date and note the change in §8 if incident-driven.

---

## 4. Local Harness Validation

The local harness mirrors `scan-quote`'s Gemini request shape **without** calling Supabase or mutating production. It reuses `scannerConfig.ts` and `geminiJson.ts` — the same normalization path as the Edge Function.

**Script:** `scripts/diagnostics/gemini-raw-response-diagnostic.ts`

### Prerequisites

- Deno installed (repo uses `npx -y deno` elsewhere).
- `GEMINI_API_KEY` in environment (from operator vault — not `.env` committed to Git).
- Local quote image: `.png`, `.jpg`, `.jpeg`, `.webp`, or `.heic`.

### Command (PowerShell)

Set the **candidate model** explicitly:

```powershell
$env:GEMINI_API_KEY = "<from-vault>"
$env:GEMINI_SCAN_MODEL = "gemini-3.1-flash-lite"

deno run --allow-read --allow-net=generativelanguage.googleapis.com `
  --allow-env=GEMINI_API_KEY,GEMINI_SCAN_MODEL,GEMINI_SCAN_TIMEOUT_MS,GEMINI_SCAN_MAX_OUTPUT_TOKENS `
  scripts/diagnostics/gemini-raw-response-diagnostic.ts --image "C:\path\to\quote.png"
```

Optional: `--print-raw` (exposes customer data — never paste unredacted output into chat or tickets).

### Pass criteria (per fixture)

| Check | Required value |
|-------|----------------|
| `model` (Request section) | Matches candidate (e.g. `gemini-3.1-flash-lite`) |
| `response_http_status` | `200` |
| `finishReason` | `STOP` (not `MAX_TOKENS`, not empty) |
| `promptTokenCount` / `candidatesTokenCount` / `totalTokenCount` | Present; `candidatesTokenCount` well below `GEMINI_SCAN_MAX_OUTPUT_TOKENS` (8192) |
| `normalized_parse_status` | `NORMALIZED_JSON_PARSE_OK` |
| `likely_subtype` | `NORMALIZED_JSON_PARSE_OK` or `MARKDOWN_WRAPPER_NORMALIZED` |
| Structural fingerprint | `line_items_present` = true, `line_items_is_array` = true for window/door quotes |

### Fail criteria (block secret change)

- `BLOCKED_OR_EMPTY_RESPONSE`
- `OUTPUT_TRUNCATION` / `OUTPUT_TRUNCATION_WITH_MARKDOWN_WRAPPER`
- `MODEL_FORMAT_DRIFT` / `UNESCAPED_STRING_CONTENT`
- `NORMALIZED_JSON_PARSE_FAILED`
- HTTP 4xx/5xx from Gemini (model not found, quota, etc.)

Run **all three fixtures** before promoting a new model ID.

---

## 5. Browser Regression Checklist

After updating `GEMINI_SCAN_MODEL` on a Supabase project, validate the **full acquisition path** in the browser. UI success alone is insufficient — correlate with Edge Function logs (§7).

### Environment targeting

| Operational role | Project ref | Frontend check |
|------------------|-------------|----------------|
| **LIVE_ACTIVE** (legacy runbook label: staging) | `zgsofkgddpcntdvpckdq` | `.env.local` / Vite URL hostname contains `zgsofkgddpcntdvpckdq` |
| **LEGACY_PARENT** (legacy runbook label: production) | `wkrcyxcnzhwjtdpmfpaf` | Explicit operator approval only — not current live |

See [`SUPABASE_TARGETING.md`](./SUPABASE_TARGETING.md) — never assume `config.toml` `project_id` equals the active CLI or frontend target.

### Canonical funnel (per quote)

```text
upload → start-upload-scan-session → scan-quote → get_scan_status
  → get_analysis_preview (teaser) → [optional OTP path for full reveal]
```

### Three-quote matrix (required on staging; recommended on production)

| # | Fixture profile | Pass criteria |
|---|-----------------|---------------|
| 1 | **Clean single-page quote** (legible contractor PDF/image) | Scan completes; preview shows proof-of-read; grade/teaser visible; no stuck `processing` |
| 2 | **Dense / multi-section quote** (many line items, long terms) | Same as #1; logs show no `MAX_TOKENS` truncation |
| 3 | **Marginal quality** (photo of printout, slight skew, or lower resolution) | Either `complete` with reasonable confidence, or controlled failure (`needs_better_upload`) — never silent hang or generic 502 loop |

### Per-quote verification steps

1. Upload quote through production UI (or staging equivalent).
2. Wait for scan to finish (poll status UI or `get_scan_status`).
3. Confirm **preview** renders (locked teaser — no full report before OTP).
4. In Supabase Dashboard → Edge Functions → `scan-quote` → Logs (or CLI log tail):
   - Confirm `model` field matches new `GEMINI_SCAN_MODEL`.
   - Confirm no `gemini_parse` errors for successful quotes.
5. In Database → `analyses` (or via RPC):
   - Row exists for `scan_session_id`.
   - `analysis_status` = `complete` (or expected terminal state for invalid/marginal docs).
   - `preview_json` populated; `full_json` present but only reachable post-verification.

### Regression fail — stop and rollback

- Scans stuck in `processing` > 3 minutes without recovery.
- Spike in `gemini_parse` / `extraction_json_parse_failed`.
- Preview missing despite `analysis_status: complete` in API.
- Model ID in logs still shows old value (secret not applied or wrong project ref).

---

## 6. Rollback Procedure

Rollback is **secret reversion**, not a code revert.

### Staging rollback

```powershell
# Restore previous authorized model
supabase secrets set GEMINI_SCAN_MODEL=gemini-3.1-flash-lite --project-ref zgsofkgddpcntdvpckdq

# Confirm presence (digest only)
supabase secrets list --project-ref zgsofkgddpcntdvpckdq
```

If rolling back **from** a failed experiment to the last known good ID, set that ID explicitly. If the previous state was the preview model:

```powershell
supabase secrets set GEMINI_SCAN_MODEL=gemini-3.1-flash-lite-preview --project-ref zgsofkgddpcntdvpckdq
```

Only use preview ID if harness proves Google still serves it — preview models are deprecated.

### LEGACY_PARENT rollback (explicit approval only)

Same commands with `--project-ref wkrcyxcnzhwjtdpmfpaf`. Requires operator approval. Not routine live rollback — LIVE_ACTIVE rollback uses `zgsofkgddpcntdvpckdq`.

### Post-rollback validation

1. Run harness with reverted model (1 fixture minimum).
2. Upload 1 quote in browser; confirm logs + `analyses` row.
3. Document incident in §8.

**No redeploy** is required for rollback unless the incident also involved a bad code deploy — model-only rollback never touches Git.

---

## 7. Supabase Secret Handling

### Project references

| Operational role | `--project-ref` |
|------------------|-----------------|
| **LIVE_ACTIVE** | `zgsofkgddpcntdvpckdq` |
| **LEGACY_PARENT** | `wkrcyxcnzhwjtdpmfpaf` |

Always pass `--project-ref` explicitly for secrets commands. Do not rely on a stale `supabase link` when touching LIVE_ACTIVE or LEGACY_PARENT.

### Required commands

**Set model (staging example):**

```powershell
supabase secrets set GEMINI_SCAN_MODEL=gemini-3.1-flash-lite --project-ref zgsofkgddpcntdvpckdq
```

**Set model (production — operator approval required):**

```powershell
supabase secrets set GEMINI_SCAN_MODEL=gemini-3.1-flash-lite --project-ref wkrcyxcnzhwjtdpmfpaf
```

**List secrets (verify presence, never log values):**

```powershell
supabase secrets list --project-ref zgsofkgddpcntdvpckdq
supabase secrets list --project-ref wkrcyxcnzhwjtdpmfpaf
```

### Required log checks (scan-quote Edge Function)

After each model change, grep or filter logs for the relevant `scan_session_id`. Structured logs emit JSON via `scannerLogger.ts`.

| Signal | Where | Healthy |
|--------|-------|---------|
| **Model used** | `gemini_request` / `gemini_parse` log fields: `model` | Matches `GEMINI_SCAN_MODEL` value |
| **finishReason** | `gemini_parse` on failure; harness on success | `STOP` on success; investigate `MAX_TOKENS` |
| **Token counts** | `promptTokenCount`, `candidatesTokenCount`, `totalTokenCount` on parse failures; harness always | Present; truncation if `candidatesTokenCount` ≈ max output budget |
| **Normalized parse status** | Harness: `normalized_parse_status`; production: absence of `gemini_parse` / `extraction_json_parse_failed` | `NORMALIZED_JSON_PARSE_OK` locally; no parse error logs in prod |
| **Scan status** | HTTP response + `scan_sessions.status` | Terminal: `complete`, `needs_better_upload`, or `invalid_document` — not infinite `processing` |
| **Analysis row created** | `analyses` table via `scan_session_id` | Row exists; `analysis_status` matches outcome; `preview_json` set for successful extractions |

**Log stages to monitor:** `gemini_request`, `gemini_parse`, `analysis_persist`, `session_finalize`.

**Never log:** raw Gemini text, base64 payloads, or full document content (already enforced in code — do not disable).

---

## 8. Incident Notes From Recent Gemini Rename

**Context (2026 Q1–Q2):** WindowMan adopted `gemini-3.1-flash-lite-preview` as the inline default in `scan-quote` / `scannerConfig.ts`. Google subsequently promoted/sunset preview IDs in favor of the stable model name **`gemini-3.1-flash-lite`**.

**Symptoms observed when preview ID stopped working:**

- Gemini HTTP errors or empty candidates on `scan-quote` invocations.
- Increased `gemini_parse` errors (`empty_text_part`, `extraction_json_parse_failed`).
- Browser: upload succeeds but scan never reaches preview; session stuck in `processing` or returns generic AI failure.
- **No code deploy** had occurred — failure was purely model ID availability.

**Remediation applied:**

1. Add `GEMINI_SCAN_MODEL` and `GEMINI_API_KEY` to Supabase/Lovable runtime secrets (see `.lovable/plan.md`).
2. Set `GEMINI_SCAN_MODEL=gemini-3.1-flash-lite` on staging, then production.
3. Introduce `scannerConfig.ts` centralization and `geminiJson.ts` normalization so format drift is observable.
4. Add local harness `scripts/diagnostics/gemini-raw-response-diagnostic.ts` for pre-flight validation.

**Lesson:** The Git default (`gemini-3.1-flash-lite-preview`) can lag Google's catalog. Production must always override via `GEMINI_SCAN_MODEL`. Treat preview model IDs as **time-limited** — validate monthly or when Google publishes deprecation notices.

---

## 9. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should staging and production be required to use the same model ID at all times, or allow staged canary? | Operator | Open |
| 2 | Automated nightly harness against a fixed fixture in CI (with secret in GitHub Actions)? | Engineering | Open — not implemented; `package.json` has TODO for scanner smoke |
| 3 | Alerting threshold for `gemini_parse` error rate (Supabase log drain / external APM)? | Operator | Open |
| 4 | When to remove `gemini-3.1-flash-lite-preview` from `DEFAULT_GEMINI_MODEL` in Git — after all environments confirmed on stable ID for 30 days? | Engineering | Open |
| 5 | Document official Google deprecation channel subscription for Gemini model lifecycle? | Operator | Open |
| 6 | Should `generate-negotiation-script` and `compare-quotes` share a separate `GEMINI_*_MODEL` secret or stay on API default? | Engineering | Open — only `scan-quote` uses `GEMINI_SCAN_MODEL` today |

---

## Forbidden Actions

The following are **explicitly prohibited** during model governance work:

| Forbidden | Why |
|-----------|-----|
| Switching to **preview** model IDs (`*-preview`) without harness + 3-quote regression | Preview IDs are deprecated without notice |
| Changing **model and prompt** in the same change window | Cannot attribute failures |
| Changing **scanner code** during model validation | Invalidates test results |
| **Deleting or bypassing** parser normalization (`normalizeGeminiJsonText`) | Hides format drift; breaks diagnostic parity |
| Relying on **browser UI alone** without Edge Function logs | UI can show stale/cached state; logs prove model + parse path |
| Committing `GEMINI_API_KEY` or live `GEMINI_SCAN_MODEL` to Git | Secret leak; config drift |
| Setting production secrets without staging pass | Violates targeting guardrails |
| Calling Gemini from the browser | Architecture violation (extraction is backend-only) |
| Deploying `scan-quote` code changes as a substitute for secret rollback | Model incidents revert via secrets first |

---

## Quick Reference

```text
Authorized model:     gemini-3.1-flash-lite
Secret name:          GEMINI_SCAN_MODEL
Config reader:        supabase/functions/_shared/scannerConfig.ts → getScannerRuntimeConfig()
Local harness:        scripts/diagnostics/gemini-raw-response-diagnostic.ts
Staging ref:          zgsofkgddpcntdvpckdq
Production ref:       wkrcyxcnzhwjtdpmfpaf
Git fallback (unset): gemini-3.1-flash-lite-preview  ← do not rely on in prod
```

**Remember:** `GEMINI_SCAN_MODEL` is runtime config in Supabase secrets, not Git config. Test with the harness, validate with 3 quotes and logs, then change the secret.
