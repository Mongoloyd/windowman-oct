## FIX 1 — adminAuth Dev Bypass Gate (Corrected)

**Verdicts**
- SAFE_TO_BUILD: **YES** (corrections C-1 and C-2 incorporated)
- SAFE_TO_DEPLOY: **CONDITIONAL_ON_OPERATOR_STEPS** (Section 7 secrets check + per-importer Case C verification must run post-deploy)

---

### 1. Goal
Force `supabase/functions/_shared/adminAuth.ts` to fail closed unless `DEV_BYPASS_ENABLED` is explicitly truthy (canonical `dev-report-unlock` pattern). Eliminate the log oracle. Add Deno coverage. Force redeploy of all 12 importer functions (11 validator-surface + 1 bundle-freshness).

---

### 2. Files changed
1. `supabase/functions/_shared/adminAuth.ts` — insert `DEV_BYPASS_ENABLED` gate; rework diagnostic log; no other logic touched.
2. `supabase/functions/_shared/adminAuth_test.ts` — **new** Deno test file (5 cases).
3. `.env.example` — add `DEV_BYPASS_ENABLED=false` and `DEV_BYPASS_SECRET=` with security comments.

**Not changed:** Edge Function business logic, RLS, schema, storage, Twilio, frontend, scanner/OTP/upload code, `dev-report-unlock` (already gated).

---

### 3. Code change — `adminAuth.ts` (lines 218–277)

Replace the existing block with:

```ts
// ── DEV BYPASS: Check X-Dev-Secret header ──────────────────────────
const normalizeSecretValue = (value: string | null): string | null =>
  value ? value.trim().replace(/^['"]+|['"]+$/g, "") : null;

const devSecretRaw = req.headers.get("x-dev-secret");

if (devSecretRaw) {
  // Header was sent — resolve bypass decisively (never fall through to JWT).
  // Canonical pattern matches supabase/functions/dev-report-unlock/index.ts:
  // tolerates whitespace and case, requires strict "true".
  const bypassEnabled =
    Deno.env.get("DEV_BYPASS_ENABLED")?.trim().toLowerCase() === "true";
  const expectedDevSecretRaw = Deno.env.get("DEV_BYPASS_SECRET");
  const devSecret = normalizeSecretValue(devSecretRaw);
  const expectedDevSecret = normalizeSecretValue(expectedDevSecretRaw ?? null);

  // Diagnostic log — no `match` field, no secret values, no lengths leaked
  // outside the gated branch.
  console.log("[adminAuth] Dev bypass attempt:", {
    bypassEnabled,
    envPresent: !!expectedDevSecretRaw,
  });

  // Gate 1: feature flag must be explicitly enabled.
  if (!bypassEnabled) {
    console.error(
      "[adminAuth] DEV BYPASS FAIL: DEV_BYPASS_ENABLED is not 'true'",
    );
    return {
      ok: false,
      response: errorResponse(
        403,
        "dev_bypass_disabled",
        "Dev bypass is not enabled on this environment",
      ),
    };
  }

  // Gate 2: server must have the secret configured.
  if (!expectedDevSecret) {
    console.error(
      "[adminAuth] DEV BYPASS FAIL: DEV_BYPASS_SECRET env var is not set on server",
    );
    return {
      ok: false,
      response: errorResponse(
        500,
        "config_error",
        "Server missing DEV_BYPASS_SECRET",
      ),
    };
  }

  // Gate 3: secret must match.
  if (devSecret !== expectedDevSecret) {
    console.error("[adminAuth] DEV BYPASS FAIL: secret mismatch");
    return {
      ok: false,
      response: errorResponse(
        401,
        "dev_bypass_mismatch",
        "Dev bypass secret does not match server",
      ),
    };
  }

  // All gates passed — grant super_admin.
  console.log("[adminAuth] DEV BYPASS GRANTED: super_admin");
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  return {
    ok: true,
    email: "dev-sandbox@windowman.app",
    userId: "dev-sandbox-bypass",
    role: "super_admin",
    supabaseAdmin,
    supabaseAuth,
  };
}
```

**Logic deltas vs current code:**
- New first gate uses canonical `?.trim().toLowerCase() === "true"` (C-1).
- Diagnostic `console.log` moved inside `if (devSecretRaw)`, drops `match`, `headerLen`, `envLen` fields → no timing/log oracle.
- Failure response order: 403 `dev_bypass_disabled` → 500 `config_error` → 401 `dev_bypass_mismatch`.
- JWT path (line 279+), role lookup, helpers, exports: untouched.

---

### 4. New file — `supabase/functions/_shared/adminAuth_test.ts`

Deno test cases:
1. No `x-dev-secret` header, no JWT → 401 `unauthorized`.
2. `x-dev-secret` present, `DEV_BYPASS_ENABLED` unset → 403 `dev_bypass_disabled`.
3. `x-dev-secret` present, `DEV_BYPASS_ENABLED=true`, `DEV_BYPASS_SECRET` unset → 500 `config_error`.
4. `x-dev-secret` wrong value, `DEV_BYPASS_ENABLED=true`, secret set → 401 `dev_bypass_mismatch`.
5. `x-dev-secret` correct, `DEV_BYPASS_ENABLED=true`, secret set → `ok: true`, `role: "super_admin"`.

Uses `Deno.env.set/delete` with cleanup; mocks `Request` with headers only.

---

### 5. `.env.example` additions

```
# Dev-only bypass for _shared/adminAuth.ts and dev-report-unlock.
# MUST remain unset or "false" in production. Setting to "true"
# enables x-dev-secret header to grant super_admin.
DEV_BYPASS_ENABLED=false
DEV_BYPASS_SECRET=
```

---

### 6. Importer redeploy scope (canonical grep, ACK-1)

```
grep -rEn "from ['\"]\.\./\_shared/adminAuth(\.ts)?['\"]|import\(['\"]\.\./\_shared/adminAuth" \
  supabase/functions --include="*.ts" \
  | grep -v "^supabase/functions/_shared/"
```

**12 importer functions total, classified per C-2:**

**11 validator/bypass-surface importers** (call `validateAdminRequest` / `validateAdminRequestWithRole` — patched gate is live on these):
1. `admin-data`
2. `contractor-actions`
3. `send-contractor-handoff`
4. `create-checkout-session` (dynamic `await import()`)
5. `dial-lead`
6. `voice-followup`
7. `admin-route-lead`
8. `admin-sync-revenue-signals`
9. `enrich-lead`
10. `lead-reactivation`
11. `refresh-benchmarks`

> Names 5–11 are placeholders pending grep run during Build; final list is whatever the canonical grep returns minus `_shared/` and minus item 12 below.

**1 corsHeaders-only / bundle-freshness importer** (no validator surface, no bypass exposure, redeploy only to keep shared bundle current):
12. `accept-invite`

All 12 redeploy. Only the 11 validator-surface importers carry bypass risk.

---

### 7. Operator post-deploy steps

**Secrets check (must run, ACK-3):**
```
supabase secrets list --project-ref wkrcyxcnzhwjtdpmfpaf | grep DEV_BYPASS
# If DEV_BYPASS_ENABLED present in production → unset:
supabase secrets unset DEV_BYPASS_ENABLED --project-ref wkrcyxcnzhwjtdpmfpaf
# Re-list to confirm absent.
```

**Per-importer Case C verification (CL-1) — production, correct `x-dev-secret`, expect `403 dev_bypass_disabled`:**
- `admin-data`
- `contractor-actions`
- `send-contractor-handoff`
- `create-checkout-session`

Plus spot-check Case B (valid JWT) on `admin-data` to confirm normal auth still works. `accept-invite` does not need a Case C check (no validator surface).

---

### 8. Risks
- **Low.** Logic is additive-restrictive; matches `dev-report-unlock` precedent verbatim. JWT path untouched.
- Operator forgets to redeploy a dynamic importer → bundle stale → still vulnerable. Mitigated by CL-1 multi-importer check.
- Operator sets `DEV_BYPASS_ENABLED=true` in prod by accident → bypass live. Mitigated by Section 7 audit + `.env.example` warning.

---

Awaiting your **Implement plan** click to enter Build mode and apply exactly the three file changes above.