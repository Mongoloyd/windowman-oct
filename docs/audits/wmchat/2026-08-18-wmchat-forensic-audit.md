# WindowMan `/wmchat` forensic audit reconciliation

> **Status:** Evidence-backed audit record, not implementation authority
>
> **Original audit date:** 2026-08-18
>
> **Reconciled against:** `forensic_report_v2` at
> `e1e54cfa5976fa94027aa4c1b14f63561e535fd2`
>
> **Runtime status:** Static inspection only. No browser, deployed Edge Function,
> database, ad-platform, or production behavior was exercised for this document.

## Purpose

This document converts the repository's raw `docs/wmchat_forensic_audit` into a
durable Markdown record and reconciles its PR #211 findings with the current
integration branch. The raw audit remains useful as a point-in-time source. Its
line numbers and CI conclusions must not be treated as current without this
reconciliation.

## Provenance and chain of custody

| Evidence | Verified value | Meaning |
| --- | --- | --- |
| Repository | `Mongoloyd/wm-mvp` | Audited repository |
| Original audit source | `docs/wmchat_forensic_audit` | Available Claude audit source; no PDF was committed |
| Audited pull request | PR #211 | Atomic WmChat post-capture persistence |
| Audited PR head | `0ff96fdb78e7b1ca93a25e7c73569f5d48c50556` | Exact source snapshot used by the original audit |
| PR #211 merge commit | `03ff9ad8ce124bc21fee3f93f9e1e4ddc3fed110` | Squash merge into `forensic_report_v2`; its tree contains the audited PR head's product result |
| Subsequent scanner fix | `79507b5c4e73a11036d66d37f7a7e6ff28227319` (PR #212) | Cancels the abandoned 280 ms scanner handoff timer |
| Subsequent CI fix | `e1e54cfa5976fa94027aa4c1b14f63561e535fd2` (PR #213) | Adds a focused WmChat contract guardrail and closes the post-capture test-package hole |
| Current verified base | `e1e54cfa5976fa94027aa4c1b14f63561e535fd2` | Classification baseline for this document |

The original audit date and audited SHA are stated in the source itself
(`docs/wmchat_forensic_audit:8-15`). Git history establishes the merge and
subsequent corrective commits. Current executable code, not the original prose,
controls every classification below.

## Status vocabulary

- **Resolved:** Current base contains a correction that directly closes the finding.
- **Partially resolved:** A safe guard exists, but the underlying capability or
  usability issue is not fully solved.
- **Still open:** Current executable code still supports the finding.
- **Superseded:** Later architecture makes the old recommendation inappropriate.
- **Unknown:** Static repository evidence cannot establish the answer.

## Executive reconciliation

The audit's core persistence conclusion remains correct. WmChat creates a
phone-identified lead whose validated intake is stored in the `wmchat_v1`
namespace. It may then persist one immutable `wmchat_post_capture_v1` sibling
namespace. The continuation branch binds the existing lead/session/source,
rejects conflicting reuse, and does not create a second lead. Nothing found in
the current base justifies weakening that contract.

Two original findings have materially changed:

1. The CI gap is **resolved** by PR #213.
2. The abandoned scanner-transition timer is **resolved** by PR #212. That issue
   was adjacent to, rather than one of, the audit's six ranked High findings.

The remaining important gaps are still real: no WmChat-specific qualified-lead
business event exists on the inspected base; a successful immutable continuation
can still expose navigation back to mutable choices; scheduling remains hidden
because no fulfillment path is proven; the `need_quote` path still has a false
summit and no bounded-progress cue; and normal refresh does not offer the safe
resume snapshot unless a resume query parameter is present.

## Reconciled findings

| Original finding | Current status | Current evidence | Reconciliation |
| --- | --- | --- | --- |
| H1: WmChat is unobservable end to end | **Still open** | `src/components/AppTrackingProvider.tsx` still suppresses application-owned page measurement on `/wmchat`; `handleWmChatPostCapture` in `supabase/functions/capture-truth-gate-lead/index.ts` persists the continuation but does not persist a canonical `lead_qualified` event | Suppression is an intentional architecture boundary, not permission to add browser pixels. A later protected measurement sprint may add a non-fatal server-authoritative event after an `inserted` continuation only. |
| H2: CI does not run the WmChat contract on the integration branch | **Resolved** | `.github/workflows/wmchat-guardrail.yml` now targets relevant pushes and PRs to `forensic_report_v2` and `main`; `package.json` includes `src/services/wmchatPostCapture.test.ts` in `test:wmchat` | PR #213 supersedes the audit's suggested vehicle. A dedicated workflow is safer than extending the PageView guardrail. Required-check enforcement remains a separate operator decision. |
| H3: Scheduling is implemented but hidden by a bare literal | **Still open, with safe behavior preserved** | `src/pages/WmChat/WmChatPage.tsx:463-465` passes `scheduleConversationVisible={false}`; `WmChatPostCaptureStage.tsx:175-182` therefore renders no scheduling action | Hiding is correct because repository search shows persistence but no durable callback/operator fulfillment consumer. Replace the anonymous literal with a named, documented false capability in a UI-only reliability sprint; do not unhide it. |
| H4: Returning to Choices after a saved continuation guarantees a conflict | **Still open** | `src/pages/WmChat/WmChatConversation.tsx:478-493` retains post-capture Back/Choices dispatch paths; the database contract remains first-write immutable and maps a different request to HTTP 409 | Success must become terminal with a readable saved-choice summary. Error must remain recoverable, and pre-persistence corrections must remain available. The immutable server rule is not the defect. |
| H5: Recap creates a false summit before five practical questions | **Still open** | `wmChatContent.ts:489-548` places `recap` before ZIP, scope, openings, budget, and timing | Move practical details before the final recap/brief, or explicitly bridge and bound the remaining work. The V2 proposal recommends moving them. |
| H6: Path-length asymmetry strands misrouted quote holders | **Still open** | `entry_need_quote` routes to `need_reason`; no quiet route from that sequence to `have_concern` exists | Add a low-salience correction affordance for a homeowner who already has a written quote. It must switch into the existing quote-holder path without corrupting `entry_intent` or the validated answer path. |
| M10: Safe resume exists but normal refresh cannot reach it | **Still open** | `WmChatPage.tsx:71-76` calls `loadWmChatResume()` only when `r` or `resume_token` is present; no in-repo URL generator was found | Use an explicit “Pick up where you left off?” offer when a fresh non-PII snapshot exists. Never silently restore on a shared device, and never treat resume state as authorization. |
| M16: Verify the post-capture request timeout contract | **Unknown in this document** | `src/services/wmchatPostCapture.ts` passes a 15-second timeout and has failure/retry coverage, but this reconciliation does not certify installed-client cancellation semantics | Resolve through a focused dependency-type and deterministic timer audit. Do not change dependencies or the request body to force a conclusion. |
| Scanner timer can navigate after Back | **Resolved** | `WmChatPage.tsx:121-150` checks that the handoff remains active, clears abandoned state, and returns a timer cleanup; PR #212 added fake-timer regression coverage | Do not reopen this lifecycle issue while redesigning copy or the `need_quote` sequence. |
| Atomic continuation persistence is unsafe or incomplete | **Superseded / rejected** | PR #211's migration, Edge validation, client service, identity binding, and tests are present on the current base | The persistence invariant is a protected constraint for later UI and measurement work, not a candidate for redesign. |

## Current executable path

```text
entry_need_quote
  -> need_reason
  -> one adaptive need_detail_* node
  -> priorities
  -> stakes (skipped on the validated short-path condition)
  -> trust
  -> recap / optional recap correction
  -> ZIP
  -> project scope
  -> openings
  -> budget posture
  -> timing
  -> optional first name
  -> phone and canonical lead capture
  -> post-capture choice
  -> one immutable continuation, or secure scanner handoff
```

The on-screen `WmChatProjectBriefPreview` is the only immediate tailored artifact
confirmed on this path. It renders at phone capture and shows a recommendation,
up to three checklist items, and one contractor question. The code does not
prove an emailed report, a booked appointment, a guaranteed quote, a price
benchmark, or a callback service level.

## Persistence and identity conclusions retained from the original audit

The following findings remain supported and should be treated as constraints:

- `wmchat_v1` and `wmchat_post_capture_v1` are sibling JSON namespaces.
- Post-capture persistence requires the trusted existing lead/session/source
  binding and a validated original intake.
- First write is immutable: an identical retry may replay; a conflicting
  submission fails closed.
- The continuation branch must not create another lead or overwrite contact
  information.
- Resume storage contains a bounded, replayable, non-PII answer path. Typed
  inputs are excluded or rewound; resume is never authorization.
- The ready-now scanner handoff is navigation, not a persisted continuation.
- Scheduling persistence is not the same as callback fulfillment.
- WmChat is not a price estimator, insurer, law firm, contractor, or booking
  system. Copy must not imply otherwise.

## Measurement interpretation

“No measurement” in the original audit must be read precisely:

- `/wmchat` intentionally has no application-owned browser page measurement.
- No arbitrary React component should call Meta, OpenAI Ads, `fbq`, `gtag`, or
  a CAPI endpoint.
- Persisted `wmchat_v1` and `wmchat_post_capture_v1` records provide
  server-side evidence for completed milestones, but not for anonymous
  abandonment before capture.
- A qualified-lead business event, if approved, belongs after successful server
  persistence and must be non-fatal and deduplicated.
- Node-level abandonment requires a separately approved operational telemetry
  contract. It must not be disguised as a paid-media conversion lane.

## Recommended sequence after this audit

1. Keep PR #213's WmChat guardrail as the referee.
2. Make successful continuation confirmation terminal while leaving errors
   retryable and preserving scanner navigation.
3. Keep scheduling hidden behind a named false capability until a real operator
   fulfillment path exists.
4. Verify/harden the client timeout in isolation.
5. Add server-authoritative qualified-lead measurement in a protected,
   non-fatal sprint.
6. Implement the `need_quote` V2 information architecture in a separate UI and
   state-machine sprint, preserving the validated fields until server contracts
   are deliberately versioned.

## Limitations

- This reconciliation is static. It does not claim the current branch is
  deployed or that remote environment flags match repository defaults.
- No live Supabase, Meta, OpenAI Ads, scanner, upload, OTP, reveal, or contractor
  system was invoked.
- The audit PDF named in the sprint request was not available in the worktree.
  The checked-in raw audit was the source of record and no PDF was added.
- Parallel local work may address open findings, but an unmerged worktree is not
  current integration-branch truth and is therefore not marked resolved here.
