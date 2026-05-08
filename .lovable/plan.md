```

```

```
# WINDOWMAN.PRO — READ-ONLY CURRENT STATE RECOVERY AUDIT

## MISSION

Perform a strict, read-only forensic audit of the current WindowMan.PRO Lovable sandbox, live deployment, GitHub `main`, and connected Supabase project.

Do not edit, add, delete, refactor, migrate, deploy, rollback, or “fix” any files.

This is a diagnostic-only audit.

The goal is to determine the current state of the app, identify the confirmed runtime failure path, verify whether OTP / Verify-to-Reveal remains structurally intact, and produce actionable advice for the smallest safe recovery path.

---

# CRITICAL CONTEXT

I recently worked on a Claude Code branch locally on my desktop.

Important:

- I did NOT merge that local Claude Code work into a live GitHub branch.
- I do NOT believe those local Claude changes should have affected Lovable, GitHub `main`, Lovable sandbox, Lovable live, or live Supabase.
- The Supabase code and Edge Function changes from that Claude work should be purely local unless Git history or deployment history proves otherwise.
- Do not assume the local Claude branch caused the current issue.
- Prove what is actually deployed.

The audit must now treat this confirmed incognito test result as the primary user-visible failure:

## CONFIRMED INCOGNITO RUNTIME FAILURE — SCAN-QUOTE 504 TIMEOUT

I tested the current Lovable sandbox in an incognito browser.

The scanner produced this runtime error:

```json
{
  "error": "AI extraction timed out",
  "scan_session_id": "d2e527bd-69a1-4ef4-96f1-7d46ef0fabc7",
  "analysis_status": "processing",
  "scan_session_status": "processing"
}
```

Runtime metadata:

```

```

```
{
  "timestamp": 1778200541036,
  "error_type": "RUNTIME_ERROR",
  "filename": "supabase/functions/scan-quote/index.ts",
  "lineno": 0,
  "colno": 0,
  "stack": "not_applicable",
  "has_blank_screen": true
}
```

This failure happened before OTP.

This test was done in incognito, so stale browser localStorage/sessionStorage is unlikely to be the primary cause.

The upload/session creation path appears to work because a `scan_session_id` exists.

The confirmed failure path is likely:

```

```

```
Upload → scan_session created → scan-quote starts → Gemini/AI extraction times out → Edge Function returns 504 → frontend treats recoverable timeout as fatal runtime error → blank screen
```

The audit must now prioritize:

- `scan-quote` timeout handling  

-   
Gemini/OCR extraction latency  

-   
stuck `processing` scan sessions  

-   
frontend handling of non-2xx scanner responses  

-   
scanner-level error boundaries  

-   
homeowner-safe recovery UI  

-   
deployment/sandbox/live drift only after the confirmed scanner failure is analyzed  


OTP may still be healthy, but the current user-visible failure happens before OTP.

---

# ABSOLUTE HARD RULES

## Read-only only

Do not:

-   
edit source files  

-   
add files  

-   
delete files  

-   
refactor files  

-   
generate migrations  

-   
apply migrations  

-   
run destructive SQL  

-   
deploy Edge Functions  

-   
deploy the frontend  

-   
change environment variables  

-   
remove secrets  

-   
rollback commits  

-   
publish Lovable live  

-   
“fix” anything automatically  


## Do not touch or weaken

Do not modify:

- `send-otp`  

- `verify-otp`  

-   
Twilio Verify config  

- `scan-quote`  

- `start-upload-scan-session`  

- `get_analysis_full`  

-   
OTP gating  

-   
full report authorization  

-   
private `quotes` storage  

-   
deterministic scoring  

-   
RLS policies  

-   
Supabase Realtime settings  

-   
production secrets  

-   
dev bypass settings  


## Verify-to-Reveal must remain sealed

This is non-negotiable:

-   
The full report must never be fetched before backend authorization.  

-   
The full report must never be preloaded and hidden with CSS.  

-   
The full report must never be broadcast through Realtime to unauthorized users.  

-   
The full report must never be exposed through a dev/admin bypass in production.  

-   
OTP verification must remain the homeowner access gate.  

-   
The frontend is untrusted.  

-   
Any full-report reveal must be authorized server-side.  


## AI boundary

Gemini / AI may only extract and classify document data.

Gemini / AI must not generate:

-   
final grade  

-   
pillar scores  

-   
deterministic scoring  

-   
report truth logic  

-   
authorization decisions  


Scoring must remain deterministic backend TypeScript.

---

# KNOWN LAST OTP BASELINE

Use this commit as the known OTP repair baseline:

```

```

```
625e931c539825a9e4e09ac31dd7df42792ac4df
```

Commit message:

```

```

```
fix: OTP verification persistence - expand CHECK constraint, return failure on DB errors, set phone_verified_at
```

This commit is important because it repaired OTP persistence by:

-   
allowing `phone_verifications.status = 'expired'`  

-   
making `verify-otp` fail closed if DB persistence fails  

-   
setting `leads.phone_verified_at`  

-   
hardening `fire_crm_handoff`  

-   
adding `leads.phone_verified_at`  


Compare the current state against that baseline, but do not assume rollback is the right answer.

---

# PRIMARY AUDIT OBJECTIVES

Answer these questions with evidence.

## 1. Did local Claude Code affect the deployed app?

Determine whether my local Claude Code work affected any live/sandbox system.

Answer:

-   
Was local Claude Code work pushed to GitHub?  

-   
Was it merged into `main`?  

-   
Was it deployed by Lovable?  

-   
Did any Supabase migration/function from that local work reach the connected Supabase project?  

-   
Is there evidence in Git history, deployment history, Lovable history, or Supabase migration/function history that the local Claude branch affected live?  


If no evidence exists, say clearly:

```

```

```
Local Claude Code changes do not appear to be the cause because they were not pushed, merged, or deployed.
```

Do not speculate.

## 2. What is actually deployed right now?

Identify:

-   
current GitHub `main` commit SHA  

-   
latest Lovable sandbox commit/version  

-   
latest Lovable live/published commit/version  

-   
whether sandbox and live are on the same commit  

-   
whether either differs from GitHub `main`  

-   
whether Supabase Edge Functions match repo files  

-   
whether live Supabase schema matches repo migrations  


If deployment-history APIs are inaccessible, explicitly say what cannot be verified and what I must check manually in Lovable/GitHub/Supabase UI.

Do not claim something is verified unless you actually inspected it.

## 3. What caused the confirmed scanner timeout / blank screen?

Prioritize the confirmed failure:

```

```

```
scan-quote returned 504: AI extraction timed out
scan_session_id existed
analysis_status remained processing
scan_session_status remained processing
frontend blank-screened
```

Determine:

-   
why `scan-quote` timed out  

-   
whether timeout is caused by Gemini latency, prompt/schema size, file size/type, storage download latency, Edge Function timeout, or frontend handling  

-   
whether the backend leaves sessions stuck in `processing`  

-   
whether the frontend throws on non-2xx scanner response  

-   
why a recoverable timeout caused `has_blank_screen: true`  


## 4. Is OTP structurally intact?

Even though the confirmed failure happens before OTP, still verify:

- `send-otp`  

- `verify-otp`  

-   
Twilio env var usage  

- `phone_verifications`  

- `leads.phone_verified`  

- `leads.phone_verified_at`  

-   
session-bound OTP persistence  

-   
fail-closed behavior  


## 5. Is Verify-to-Reveal structurally intact?

Verify:

- `get_analysis_full(uuid,text)`  

-   
scan-session-bound authorization  

- `__UNAUTHORIZED__` sentinel behavior  

-   
no full report exposure before OTP  

-   
no Realtime full JSON leak  

-   
no frontend preloading of full report  


---

# REQUIRED AREAS TO INSPECT

## Frontend scanner / intake / runtime failure path

Inspect:

- `src/pages/Index.tsx`  

- `src/components/TruthGateFlow.tsx`  

- `src/components/UploadZone.tsx`  

- `src/hooks/useQuoteScanner.ts`  

- `src/hooks/useGatedAIScanner.ts`  

-   
any service/helper that calls `scan-quote`  

-   
any scanner status/polling hook  

-   
any localStorage/sessionStorage/Zustand funnel persistence  

-   
any scanner/report error boundary  

-   
any runtime error handling around the scanner flow  


Answer:

-   
Which exact frontend function invokes `scan-quote`?  

-   
What happens when `scan-quote` returns 504?  

-   
Is the non-2xx response thrown as an uncaught error?  

-   
Is the error caught locally?  

-   
Is there a scanner-specific error boundary?  

-   
Why did the user get a blank screen?  

-   
Is `scan_session_id` preserved after timeout?  

-   
Is there a UI state for “still processing”?  

-   
Is there a UI state for “AI extraction timed out”?  

-   
Is there a UI state for “needs better upload”?  

-   
Is there a UI state for “manual review”?  

-   
Does the UI expose raw JSON/runtime metadata to the homeowner?  


## Backend scanner / scan orchestration

Inspect:

- `supabase/functions/scan-quote/index.ts`  

- `supabase/functions/scan-quote/requestSchema.ts`  

- `supabase/functions/scan-quote/sessionRecovery.ts`  

- `supabase/functions/scan-quote/reportCompiler.ts`  

- `supabase/functions/scan-quote/scoring.ts`  

- `supabase/functions/start-upload-scan-session/index.ts`  

- `supabase/config.toml`  

-   
scanner runtime config files  

-   
scanner logger files  

-   
Gemini config files  

-   
extraction timeout handling  

-   
analysis upsert logic  

-   
scan session status update logic  


Answer:

-   
Where is the AI extraction call made?  

-   
What timeout is used?  

-   
Is the timeout frontend-driven or backend-driven?  

-   
Does `scan-quote` catch Gemini timeout distinctly?  

-   
When timeout happens, does it update `scan_sessions.status`?  

-   
When timeout happens, does it update or insert an `analyses` row?  

-   
Why did both statuses remain `processing`?  

-   
Can the session remain stuck forever?  

-   
Is there an idempotent retry path?  

-   
Is there a recovery sweep for stuck `processing` sessions?  

-   
Is `sessionRecovery.ts` actually used?  

-   
Does retry call Gemini again safely or create duplicates?  

-   
Does retry preserve the same `scan_session_id`?  


## OTP / Twilio

Inspect:

- `supabase/functions/send-otp/index.ts`  

- `supabase/functions/verify-otp/index.ts`  

- `src/hooks/usePhonePipeline.ts`  

- `src/services/phoneVerificationService.ts`  

- `src/components/TruthReportFindings/PhoneVerifyModal.tsx`  

- `src/components/TruthReportFindings/VerifyGate.tsx`  


Answer:

-   
Does `send-otp` bind pending OTP rows to `scan_session_id`?  

-   
Does `verify-otp` prefer the pending row for the same `scan_session_id`?  

-   
Does it avoid silently rebinding a pending row from another scan?  

-   
Does it persist:  

  - `phone_verifications.status = 'verified'`  

  - `phone_verifications.verified_at`  

  - `phone_verifications.lead_id`  

  - `phone_verifications.scan_session_id`  

  - `leads.phone_verified = true`  

  - `leads.phone_verified_at`  

-   
Does it fail closed on DB persistence errors?  

-   
Could OTP succeed with Twilio but fail full-report reveal because session binding is missing or mismatched?  


## Database / Supabase schema / RLS / RPC

Use read-only introspection only.

Inspect:

- `public.phone_verifications`  

- `public.scan_sessions`  

- `public.leads`  

- `public.analyses`  

- `public.get_analysis_full(uuid,text)`  

-   
storage policies for the `quotes` bucket  

-   
Realtime publication tables  

-   
relevant migrations  


Check whether live Supabase has:

- `phone_verifications.status` CHECK allowing:  

  - `pending`  

  - `verified`  

  - `failed`  

  - `expired`  

- `phone_verifications.scan_session_id`  

- `phone_verifications.lead_id`  

- `leads.phone_verified`  

- `leads.phone_verified_at`  

-   
strict `get_analysis_full(uuid,text)` authorization  

-   
no public full-report bypass  


If you can inspect live Supabase rows safely, inspect the specific failed scan session:

```

```

```
d2e527bd-69a1-4ef4-96f1-7d46ef0fabc7
```

Read only.

For that scan session, determine:

-   
Does the row exist?  

-   
What is `scan_sessions.status` now?  

-   
What is `scan_sessions.lead_id`?  

-   
Does an `analyses` row exist?  

-   
What is `analyses.analysis_status`?  

-   
Did it eventually complete after the frontend failed?  

-   
Is it still stuck in `processing`?  

-   
Are there error logs/metadata?  

-   
Is there a quote file attached?  


Do not mutate the row.

## Supabase Edge Function logs

Inspect read-only logs for:

- `scan-quote`  

- `start-upload-scan-session`  

- `send-otp`  

- `verify-otp`  


For the failed scan session:

```

```

```
d2e527bd-69a1-4ef4-96f1-7d46ef0fabc7
```

Find:

-   
upload event  

-   
scan start  

-   
file download  

-   
Gemini request start  

-   
Gemini timeout  

-   
status update attempt  

-   
analysis upsert attempt  

-   
returned 504  

-   
frontend/network response  


If logs are inaccessible, state that clearly and specify where I should manually check.

---

# SAFE READ-ONLY SQL CHECKS

If live Supabase SQL introspection is available, use read-only queries only.

Do not run mutation queries.

Suggested checks:

```

```

```
select version, name, inserted_at
from supabase_migrations.schema_migrations
order by inserted_at desc;
```

```

```

```
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'phone_verifications'
order by ordinal_position;
```

```

```

```
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'leads'
  and column_name in ('phone_verified', 'phone_verified_at', 'phone_e164');
```

```

```

```
select pg_get_functiondef('public.get_analysis_full(uuid,text)'::regprocedure);
```

```

```

```
select *
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('analyses', 'scan_sessions', 'leads', 'phone_verifications');
```

```

```

```
select id, status, lead_id, created_at, updated_at
from public.scan_sessions
where id = 'd2e527bd-69a1-4ef4-96f1-7d46ef0fabc7';
```

```

```

```
select id, scan_session_id, analysis_status, grade, created_at, updated_at
from public.analyses
where scan_session_id = 'd2e527bd-69a1-4ef4-96f1-7d46ef0fabc7'
order by created_at desc;
```

```

```

```
select id, scan_session_id, lead_id, file_path, created_at
from public.quote_files
where scan_session_id = 'd2e527bd-69a1-4ef4-96f1-7d46ef0fabc7';
```

Only run these if the tables/columns exist.

If a query cannot run because a table/column is unavailable, report the exact mismatch.

---

# VERIFY-TO-REVEAL MOAT AUDIT

Trace the exact full report reveal path:

1.   
User uploads quote  

2.   
scan session is created  

3.   
quote file is stored  

4. `scan-quote` begins  

5.   
AI extraction runs  

6.   
deterministic scoring runs  

7.   
preview/locked state is produced  

8.   
phone is submitted  

9. `send-otp` is called  

10.   
OTP code is submitted  

11. `verify-otp` is called  

12.   
DB verification is persisted  

13.   
frontend requests full report  

14. `get_analysis_full` authorizes or denies  

15.   
full report is rendered  


For each step, document:

-   
file/function involved  

-   
input IDs  

-   
output IDs  

-   
persisted DB rows  

-   
local browser state  

-   
possible failure point  

-   
whether failure is safe or unsafe  

-   
whether the current confirmed 504 could interrupt that step  


Output table:


| Step | File / Function | Input | Output | Persistence | Failure Mode | Safe? | Related to 504? |
| ---- | --------------- | ----- | ------ | ----------- | ------------ | ----- | --------------- |


---

# SCANNER 504 TIMEOUT RUNTIME DIAGNOSIS

Add a dedicated section called:

```

```

```
## Scanner 504 Timeout Runtime Diagnosis
```

Answer all of the following:

1.   
Which frontend file/function invokes `scan-quote`?  

2.   
When `scan-quote` returns a non-2xx response, does the frontend throw an uncaught error?  

3.   
Does the scanner caller distinguish between:  

  -   
  fatal backend error  

  -   
  AI extraction timeout  

  -   
  still processing  

  -   
  invalid document  

  -   
  needs better upload  

  -   
  manual review  

4.   
Why did the runtime error create `has_blank_screen: true`?  

5.   
Is there a local scanner-level error boundary?  

6.   
If there is an error boundary, why did it not catch this failure cleanly?  

7.   
Does `scan-quote` persist a final failure/recovery status when AI extraction times out?  

8.   
Why did the returned status remain:  

  - `analysis_status: "processing"`  

  - `scan_session_status: "processing"`  

9.   
Can the scan session remain stuck in `processing` forever?  

10.   
Is there a safe read-only way to check whether scan session `d2e527bd-69a1-4ef4-96f1-7d46ef0fabc7` later completed, failed, or remained stuck?  

11.   
Is there currently a polling/retry/status-check path after timeout?  

12.   
Does retrying the same scan create duplicate sessions or duplicate analyses?  

13.   
Is the timeout likely caused by:  


-   
oversized file  

-   
PDF/image format  

-   
Gemini latency  

-   
excessive extraction prompt/schema size  

-   
Edge Function timeout limit  

-   
storage download latency  

-   
frontend caller timeout  


14.   
Does the current UI show a homeowner-safe message for scanner timeout, or does it expose raw JSON/runtime state?  

15.   
Is there a manual review fallback?  

16.   
Is there a “try another upload” fallback?  

17.   
Is there a “check again” or polling fallback?  

18.   
Does the failure occur before any OTP logic is reached?  

19.   
Does the failure affect the Verify-to-Reveal moat?  

20.   
What is the smallest safe future code change needed, if any?  


Required tables:


| Failure Point | Evidence | File / Function | Current Behavior | Expected Safe Behavior | Code Change Needed Later? |
| ------------- | -------- | --------------- | ---------------- | ---------------------- | ------------------------- |



| Status Field        | Observed Value                       | Where Set | Should It Stay This Way After Timeout? | Risk   |
| ------------------- | ------------------------------------ | --------- | -------------------------------------- | ------ |
| scan_session_id     | d2e527bd-69a1-4ef4-96f1-7d46ef0fabc7 | &nbsp;    | &nbsp;                                 | &nbsp; |
| scan_session_status | processing                           | &nbsp;    | &nbsp;                                 | &nbsp; |
| analysis_status     | processing                           | &nbsp;    | &nbsp;                                 | &nbsp; |


---

# RECENT CHANGE AUDIT

Compare current state against:

```

```

```
625e931c539825a9e4e09ac31dd7df42792ac4df
```

Focus only on changes that could affect:

-   
Supabase  

-   
migrations  

-   
Edge Functions  

-   
scanner/upload path  

- `scan-quote`  

-   
Gemini extraction  

-   
timeout handling  

-   
frontend scanner status handling  

-   
Twilio OTP  

-   
full report reveal  

-   
scan session binding  

-   
storage policies  

-   
Realtime exposure  

-   
admin/dev bypasses  

-   
Lovable deployment behavior  


Output:


| Change Area | File / Migration | Date / Commit | Risk | Could Break Scanner? | Could Break OTP? | Could Break Reveal? | Could Expose Data? |
| ----------- | ---------------- | ------------- | ---- | -------------------- | ---------------- | ------------------- | ------------------ |


Do not include irrelevant UI-only changes unless they affect the scanner, upload, OTP, reveal, or runtime crash path.

---

# SECURITY WARNING TRIAGE

Investigate whether these are actually present in current repo and/or live Supabase:

- `dev-report-unlock` bypasses OTP gate  

- `send-contractor-handoff` unauthenticated or dev-bypass-authenticated  

-   
full report data broadcast through Realtime  

- `scan_sessions` Realtime leak  

-   
routing RPCs exposing `crm_webhook_url` or `crm_email`  

-   
broad storage UPDATE policy on `quotes`  

-   
unauthenticated `refresh-benchmarks`  

- `create-checkout-session` GET diagnostic exposure  

- `x-dev-secret` CORS/dev bypass exposure  

-   
public/authenticated `SECURITY DEFINER` functions  

-   
GraphQL schema exposure of sensitive objects  


For each warning, classify:


| Warning | Present in Repo? | Present in Live Supabase? | Real Risk / Partial / Scanner Noise | Severity | Related to Current 504? | Recommended Fix Later |
| ------- | ---------------- | ------------------------- | ----------------------------------- | -------- | ----------------------- | --------------------- |


Important:

-   
Do not conflate these security warnings with the confirmed 504 unless there is evidence.  

-   
The current user-visible failure is `scan-quote` timeout before OTP.  

-   
Security issues should be triaged separately.  


---

# ROOT CAUSE RANKING RULES

Because of the confirmed incognito 504, root cause candidates must be re-ranked.

The scanner timeout / blank-screen path should now be considered higher priority than:

-   
stale browser storage  

-   
OTP mismatch  

-   
Twilio env drift  

-   
live-vs-sandbox mismatch  

-   
local Claude branch  


Still check those, but the confirmed runtime error must drive the audit.

Rank likely causes from most likely to least likely.

For each root cause candidate, provide:

-   
evidence  

-   
files/functions involved  

-   
how to verify  

-   
whether code changes are needed later  

-   
whether it affects scanner, OTP, reveal, or security  


Output:


| Rank | Candidate | Evidence | How to Verify | Affects Scanner? | Affects OTP? | Affects Reveal? | Needs Code Later? |
| ---- | --------- | -------- | ------------- | ---------------- | ------------ | --------------- | ----------------- |


---

# RECOVERY PLAN REQUIRED — NO IMPLEMENTATION

Do not implement anything.

Provide a staged recovery plan.

## Stage 1 — Confirm deployed state

List exactly what I should check in:

-   
Lovable History  

-   
Lovable Publish status  

-   
GitHub `main`  

-   
Supabase Dashboard  

-   
Supabase Edge Function timestamps  

-   
Supabase Edge Function logs  

-   
Supabase SQL Editor  

-   
Twilio Verify logs  

-   
browser Network tab  

-   
browser Console  


## Stage 2 — Confirm scanner 504 cause

Give the smallest safe diagnostic actions to confirm:

-   
whether the failed scan remained stuck  

-   
whether scan-quote timed out consistently  

-   
whether this is file-specific  

-   
whether this is prompt/schema latency  

-   
whether this is Edge Function timeout  

-   
whether frontend throws on 504  

-   
whether sandbox and live differ  


## Stage 3 — Restore scanner health later without weakening security

Do not implement now.

Describe the likely future implementation categories:

-   
frontend 504 handling  

-   
scanner-level error boundary  

-   
controlled “still analyzing” state  

-   
limited polling/retry  

-   
stuck-processing recovery  

-   
timeout status finalization  

-   
manual review / better upload fallback  


## Stage 4 — Restore OTP/report health only if needed

If OTP/reveal is not the confirmed failure, say so.

If it is affected, provide the smallest safe future actions.

Do not recommend broad rollback unless absolutely necessary.

## Stage 5 — Security containment

Give separate future containment actions for:

- `dev-report-unlock`  

- `DEV_BYPASS_SECRET`  

- `x-dev-secret`  

-   
unauthenticated admin/cron endpoints  

-   
dangerous RPC grants  

-   
Realtime sensitive tables  

-   
quote storage overwrite policy  


Do not implement now.

## Stage 6 — Rollback only if necessary

If rollback is necessary, compare:

-   
rolling back to `625e931c539825a9e4e09ac31dd7df42792ac4df`  

-   
reverting only scanner-related commits  

-   
reverting only Supabase/function changes  

-   
forward-fixing current main  


Give a recommendation.

Do not recommend rollback unless the evidence proves the current state is unrecoverable by forward-fix.

---

# FINAL OUTPUT FORMAT

Return the audit in this exact structure:

## 1. Executive Summary

Answer:

-   
Is this likely caused by local Claude Code? yes/no/unknown  

-   
Is GitHub `main` affected? yes/no/unknown  

-   
Is Lovable sandbox affected? yes/no/unknown  

-   
Is Lovable live affected? yes/no/unknown  

-   
Is live Supabase affected? yes/no/unknown  

-   
Is OTP currently structurally intact? yes/no/unknown  

-   
Is full report reveal structurally intact? yes/no/unknown  

-   
Is the confirmed failure before OTP? yes/no  

-   
Is the confirmed failure primarily scanner timeout handling? yes/no/unknown  

-   
Is the blank screen caused by frontend error handling? yes/no/unknown  


## 2. Current Deployment Map

Table comparing:

-   
GitHub `main`  

-   
Lovable sandbox  

-   
Lovable live  

-   
Supabase functions  

-   
Supabase migrations  

-   
Supabase live schema  

-   
Twilio Verify config status  


Use:


| Surface | Current Version / Evidence | Matches Expected? | Unknowns | Notes |
| ------- | -------------------------- | ----------------- | -------- | ----- |


## 3. Confirmed Runtime Failure Summary

Summarize the incognito 504 failure and what it proves.

Include:

- `scan_session_id`  

-   
observed statuses  

-   
likely phase of failure  

-   
what is ruled out  

-   
what is not yet ruled out  


## 4. Scanner 504 Timeout Runtime Diagnosis

Answer all Scanner 504 questions and include the required tables.

## 5. End-to-End Flow Map

Trace upload → scan → preview → OTP → reveal.

Use the required table.

## 6. Last Known-Good Baseline Comparison

Compare current state against:

```

```

```
625e931c539825a9e4e09ac31dd7df42792ac4df
```

Separate:

-   
scanner changes  

-   
OTP changes  

-   
reveal changes  

-   
Supabase changes  

-   
deployment changes  

-   
security changes  


## 7. Root Cause Candidates

Rank root causes using the required table.

The confirmed 504 scanner timeout path must be ranked first unless evidence proves otherwise.

## 8. Verify-to-Reveal Integrity

Confirm whether the full report moat is intact.

Answer:

-   
Is full report preloaded?  

-   
Is full report hidden by CSS?  

-   
Is full report exposed through Realtime?  

-   
Is full report exposed through dev-report-unlock?  

-   
Does `get_analysis_full` enforce strict authorization?  

-   
Can a verified phone unlock a different scan?  

-   
Does scanner timeout expose full data?  


## 9. OTP / Twilio Integrity

Confirm whether OTP is structurally intact.

Explain whether the confirmed error happens before OTP.

## 10. Security Warning Triage

Use the required security warning table.

## 11. Recovery Plan

Provide the staged recovery plan.

No implementation.

## 12. Do-Not-Touch List

List everything that must not be modified during repair.

Include at minimum:

- `send-otp`  

- `verify-otp`  

-   
Twilio secrets  

- `get_analysis_full`  

-   
OTP gate  

-   
deterministic scoring  

-   
full report authorization  

-   
RLS  

-   
storage policies  

- `scan-quote` until the audit proves exactly what to change  


## 13. Exact Next Prompt

Write the next implementation prompt I should use only after this audit is complete.

The next prompt must be scoped to the smallest safe change.

If the audit confirms scanner timeout handling is the issue, the next prompt should focus only on:

-   
handling `scan-quote` 504 safely  

-   
preserving `scan_session_id`  

-   
preventing blank screen  

-   
adding controlled recovery UI  

-   
polling/check-again only if safe  

-   
finalizing stuck statuses only if safe  

-   
not touching OTP or Verify-to-Reveal  


---

# FINAL INSTRUCTION

Do not make changes.

Do not implement.

Do not deploy.

End with:

1.   
whether this is primarily scanner timeout handling, deployment mismatch, or OTP/reveal failure  

2.   
the smallest safe diagnostic next step  

3.   
the exact implementation prompt to use later only if code changes are approved  


```

```

```

```