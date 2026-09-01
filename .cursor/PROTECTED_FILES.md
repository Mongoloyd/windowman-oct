# Protected Files Manifest — WindowMan.PRO

Canonical list for the `developer-babysitter` subagent and human operators.
**When in doubt, stop and open a scoped sprint** instead of ad-hoc edits.

## How to use

| Tier | Meaning | Without `SPRINT APPROVAL:` |
|------|---------|----------------------------|
| **A** | Hard stop — moat / OTP / reveal / Scanner Brain | Do not edit |
| **B** | Sprint-only — schema, RLS, storage policy | Dedicated migration sprint required |
| **C** | Measurement / CAPI protected | Dedicated measurement sprint required |
| **D** | Caution — no autonomous edits | Explicit human approval per change |

### Override phrase

To unblock a protected path, the user must provide:

```text
SPRINT APPROVAL: <sprint-name> — <one-line scope>
```

The babysitter may **PROCEED** only for files explicitly named in that scope.

---

## Tier A — Hard stop (moat / reveal / OTP)

| Path | Why protected |
|------|----------------|
| `supabase/functions/send-otp/**` | Twilio Verify send, rate limits, `phone_verifications` insert |
| `supabase/functions/verify-otp/**` | Twilio check, lead unlock, canonical `phone_verified` / `report_revealed` events |
| `supabase/functions/report-access/**` | Service-role proxy for preview/full; post-OTP full fetch gate |
| `supabase/functions/_shared/otpQaBypass.ts` | QA bypass evaluation shared by send-otp / verify-otp |
| `supabase/functions/scan-quote/**` | Scanner Brain: extraction → deterministic scoring → `analyses` upsert |
| `supabase/functions/quote-intelligence-worker/**` | private quote download, service-role database and Storage access, Gemini extraction, intelligence persistence |
| `supabase/functions/dev-report-unlock/**` | Dev-only full-report bypass; must not generalize to prod |
| `src/components/post-scan/PostScanReportSwitcher.tsx` | In-page post-scan orchestrator (OTP, reveal, CTA) |
| `src/pages/ReportClassic.tsx` | Classic-route OTP orchestrator (`/report/classic/:sessionId`) |
| `src/components/LockedOverlay.tsx` | Live gate UI shell; do not move orchestration here |
| `src/services/phoneVerificationService.ts` | Sole transport for `send-otp` / `verify-otp` |
| `src/services/reportService.ts` | Sole production transport to `report-access`; unauthorized envelope translation |
| `src/hooks/useAnalysisData.ts` | Three-phase contract: preview / full / resume |
| `src/hooks/usePhonePipeline.ts` | Two modes only: `validate_only`, `validate_and_send_otp` |
| `src/lib/deriveRevealPhase.ts` | Canonical `RevealPhase` mapping |
| `src/types/revealPhase.ts` | `RevealPhase` union — no new phases without sprint |
| `src/components/TruthReportClassic.tsx` | Presentational only; do not move orchestration logic here |

### Deprecated / Quarantined OTP-Reveal Components

These files are not on the canonical live reveal path as of the latest read-only import graph audit.

They are protected from accidental resurrection, not because they are active production owners.

| Path | Status |
|------|--------|
| `src/components/TruthReportFindings/VerifyGate.tsx` | Deprecated / quarantined. Contains stale OTP/reveal behavior and stale `otp_verified` browser business-event fire. Do not import into production. Removal requires a dedicated deprecation sprint. |
| `src/components/TruthReportFindings/PhoneVerifyModal.tsx` | Deprecated / quarantined. Contains stale OTP/reveal behavior and stale `otp_verified` browser business-event fire. Do not import into production. Removal requires a dedicated deprecation sprint. |
| `src/components/TruthReportFindings/VerifyBanner.tsx` | Deprecated / quarantined presentational orphan. No OTP transport or tracking fire, but do not rewire into production. Removal requires a dedicated deprecation sprint. |

**Canonical live owners:**

- `src/components/post-scan/PostScanReportSwitcher.tsx`
- `src/pages/ReportClassic.tsx`
- `src/hooks/usePhonePipeline.ts`
- `src/services/phoneVerificationService.ts`
- `src/services/reportService.ts`

**Canonical business events:**

- `phone_verified`
- `report_revealed`

Do not use `otp_verified` for new browser business events.

**Related locked behavior (any file):**

- Twilio secrets or Verify behavior changes
- Client-side full report before `phone_verified_at`
- CSS/DOM blur as substitute for backend authorization
- Third mode on `usePhonePipeline`
- New `RevealPhase` values without sprint
- Direct browser `supabase.rpc("get_analysis_preview")` or `supabase.rpc("get_analysis_full")` on production paths
- Production use of `OTP_QA_BYPASS_*` env vars

---

## Tier B — Sprint-only (schema / RLS / storage)

| Path / surface | Rule |
|----------------|------|
| `supabase/migrations/**` | Schema/RLS changes only in a dedicated migration sprint |
| `src/integrations/supabase/types.ts` | Generated/types — no drive-by edits |
| RLS on `leads`, `analyses`, `phone_verifications`, `scan_sessions`, `quote_files` | Never weaken for convenience |
| Storage bucket `quotes` | Must remain private; signed URLs only |
| `public.profiles` auto-create trigger on `auth.users` | Do not remove without full replacement plan |
| `supabase/config.toml` — blocks `[functions.send-otp]`, `[functions.verify-otp]`, `[functions.report-access]` | Sprint-only: `verify_jwt`, CORS, or function config changes require named sprint approval |
| `supabase/functions/admin-data/**` | Admin operator API — do not loosen, bypass, or weaken auth for convenience |
| `supabase/functions/_shared/adminAuth.ts` | Shared admin JWT / dev-secret gate — sprint-only |

**Admin authority (sprint-only — any file):**

- `admin-data` and `adminAuth` must not be loosened, bypassed, or weakened for convenience.
- Any change to admin auth, dev bypass, role checks, or service-role admin behavior requires `SPRINT APPROVAL: <name> — <one-line scope>` and **developer-babysitter** review.
- Temporary auth weakening is **forbidden**.

---

## Tier C — Measurement / CAPI protected

From `docs/measurement/CAPI_OPERATOR_HANDOFF_PACKET.md` §5 and related measurement docs.

| Path | Rule |
|------|------|
| `src/lib/metaBrowserPixel.ts` | Browser Meta at approved ceiling (`init` + `PageView`) |
| `src/lib/openAiAdsPixel.ts` | Consent, single init, `page_viewed`, and server-ID `lead_created` Pixel mirror only |
| `src/lib/openAiAdsPixel.test.ts` | OpenAI Ads Pixel consent/dedupe regression contract — do not weaken to green CI |
| `src/components/AppTrackingProvider.tsx` | Meta `PageView` and OpenAI Ads `page_viewed` routing only |
| `src/services/truthGateLeadCapture.ts` | OpenAI Ads browser mirror only after new-persist response with server event ID |
| `src/services/truthGateLeadCapture.test.ts` | New/reused/failed OpenAI lead boundary regression contract |
| `supabase/functions/capture-truth-gate-lead/index.ts` | New-lead-only OpenAI Ads CAPI owner and event-ID authority |
| `supabase/functions/_shared/openAiAdsConversions.ts` | OpenAI Ads CAPI schema, hashing, URL trust, timeout, and secret boundary |
| `supabase/functions/_shared/openAiAdsConversions.test.ts` | OpenAI Ads CAPI regression contract — do not weaken to green CI |
| `supabase/functions/_shared/capiRouting.ts` | Routing precedence — sprint only |
| `supabase/functions/_shared/mapToMeta.ts` | Payload shape — sprint only |
| `supabase/functions/capi-event/index.ts` | Hashing, fallback, pre-hashed pass-through |
| `supabase/functions/capi-event/index.test.ts` | Regression tests — do not weaken to green CI |
| `.github/workflows/pageview-guardrail.yml` | Do not disable |
| `scripts/pageview-dedupe-test.tsx` | PageView proof — do not delete |
| `vitest.proof.config.ts` | Proof test config — do not delete |

**Measurement behavioral stops (any file):**

- `fbq("track", ...)` for events other than `PageView`
- Browser `fetch` / `supabase.functions.invoke("capi-event")`
- Browser Meta access token read/send
- Extra browser Meta pixel IDs beyond `VITE_META_PIXEL_ID`
- OpenAI Ads events beyond consent-gated `page_viewed` and server-confirmed
  `lead_created` with the unchanged server event ID
- Browser OpenAI Ads user matching or raw PII in Pixel `measure` calls
- OpenAI Ads CAPI credentials in any `VITE_*` variable or browser code
- OpenAI Ads CAPI for reused or failed TruthGate captures
- Removing `isSha256Hex` pass-through, IP/UA fallback, or `em`/`ph` wrapping in `capi-event`
- Disabling PageView CI guardrail or `capi-event` tests

---

## Tier D — Autonomous-edit caution

| Path | Rule |
|------|------|
| `src/App.tsx` | No autonomous route mounts; DEV-only routes need explicit approval |

---

## Path matching rules

Treat a path as protected if:

1. It equals a listed file path, or
2. It starts with a listed directory prefix (e.g. `supabase/functions/send-otp/foo.ts`), or
3. The change weakens a **Related locked behavior** above (even in unlisted files).

---

## Reference docs (read before overriding)

| Doc | Use when |
|-----|----------|
| [docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md](../docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md) | **First read** — canonical Verify-to-Reveal transport and protection |
| [docs/sprints/phase-0-repo-truth-audit.md](../docs/sprints/phase-0-repo-truth-audit.md) | §7 — Phase 1 allowed / forbidden surfaces (transport may be stale — see contract doc) |
| [docs/measurement/MEASUREMENT_DISCREPANCY_DECISION_TREE.md](../docs/measurement/MEASUREMENT_DISCREPANCY_DECISION_TREE.md) | §H — Suspect a protected file |
| [docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md](../docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md) | §5–8 — Measurement boundaries |
| [docs/measurement/CAPI_OPERATOR_HANDOFF_PACKET.md](../docs/measurement/CAPI_OPERATOR_HANDOFF_PACKET.md) | §5 — CAPI protected boundaries |
| [AGENTS.md](../AGENTS.md) | Non-negotiables, sprint priority, Definition of Done |

---

## Maintenance

When adding a new protected surface, update **this file first**, then mention it in the sprint doc that introduced the boundary. Do not scatter one-off protected lists in PR descriptions.
