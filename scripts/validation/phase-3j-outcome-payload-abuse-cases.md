# Phase 3J — Outcome Payload Abuse Cases

Validation target: `supabase/functions/partner-update-disposition/index.ts`.

These abuse cases are intentionally non-destructive. Runtime calls without an authenticated contractor token were executed and returned `401 unauthenticated`; authenticated mutation tests require isolated contractor fixtures and cleanup in a non-production harness.

| Abuse case | Payload shape | Backend guard observed in code | Expected result |
| --- | --- | --- | --- |
| Missing body | `{}` | Requires bearer JWT before body validation | `401 unauthenticated` without token; with token, `400 invalid_input` for missing `opportunity_id` |
| Missing `opportunity_id` | `{ "disposition_state": "sold_closed" }` | Lines 288-293 require string `opportunity_id` | Reject |
| Missing `disposition_state` | `{ "opportunity_id": "..." }` | Lines 294-299 require string `disposition_state` | Reject |
| Invalid disposition enum | `{ "opportunity_id": "...", "disposition_state": "soldish" }` | `VALID_STATES` allow-list, lines 300-307 | Reject |
| Sold with zero value | `final_value_cents: 0` | Lines 372-384 require positive integer greater than zero | Reject |
| Sold with negative value | `final_value_cents: -1` | Lines 372-384 and 403-411 reject non-positive/negative values | Reject |
| Sold with missing currency | No `sold_currency` accepted from request | Function does not trust caller-supplied currency; existing DB default/persisted value is used | No caller-controlled currency mutation |
| Sold with missing value basis | Missing `value_basis` | Lines 385-391 require explicit basis | Reject |
| Sold with `value_basis: unknown` | `value_basis: "unknown"` | Lines 339-350 and 385-391 reject unknown | Reject |
| Lost with missing reason code | `disposition_state: "lost_dead"` and no reason code | Lines 353-362 require reason code | Reject |
| Lost with missing reason text | `lost_dead` and blank `notes` | Lines 363-369 require typed notes | Reject |
| Mismatched assignment/client | `lead_assignment_id` from another client | Lines 484-519 compare server-resolved client context to assignment client | Reject with `assignment_client_mismatch` |
| Mismatched contractor account/client | `contractor_account_id` from another client | Lines 521-568 compare server-resolved client context to contractor account client | Reject with `contractor_client_mismatch` |
| Spoofed `client_slug` | Client slug not matching server-resolved context | Lines 571-579 reject mismatch | Reject |
| Spoofed contractor account | Account linked to different auth user | Lines 548-557 compare account `auth_user_id` to authenticated JWT user | Reject with `contractor_account_forbidden` |
| Spoofed operator/admin ID | Caller-supplied operator fields | Function derives actor from JWT and does not accept operator/admin ID fields | Ignored / no privileged mutation |
| Unexpected extra fields | Additional JSON keys | Function destructures allow-listed fields into `updatePayload` | Ignored safely; no sensitive mutation |
| Duplicate terminal transition | Existing `sold_closed` or `lost_dead` to another terminal | `TRANSITIONS` disallow moves from terminal states | Reject |
| Duplicate sold lifecycle | Separate revenue sync path | `admin_revenue_signal_eligibility()` detects duplicate lifecycle keys; `admin_sync_revenue_signals(..., true)` blocks them | Duplicate-protected before dispatch |
| Duplicate revenue signal key | Existing active signal key | `admin_revenue_signal_eligibility()` returns duplicate flags; dry-run excludes from `would_insert` | Duplicate-protected |

Runtime limitation: mutation-bearing authenticated abuse tests were not run because this sprint must not mutate production tenant records and no isolated contractor fixture with cleanup token was available.
