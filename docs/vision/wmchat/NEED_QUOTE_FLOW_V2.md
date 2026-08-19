# WmChat `need_quote` flow V2

> **Status:** Proposed product and implementation architecture. No runtime
> authority.
>
> **Evidence base:** `forensic_report_v2` at
> `e1e54cfa5976fa94027aa4c1b14f63561e535fd2`
>
> **Primary audience:** Florida homeowners, especially mobile users age 50+,
> who want help preparing for a first window or door quote.
>
> **Hard boundary:** This flow prepares a request checklist and contractor
> questions. It does not calculate a guaranteed price, provide insurance or
> legal advice, book an appointment, or replace Verify-to-Reveal.

## Product decision

The current `need_quote` path earns trust through specificity, but it makes the
visitor experience thirteen post-entry interactions as an unbounded sequence.
It then presents a recap that sounds final before asking ZIP, scope, opening
count, budget posture, timing, name, and phone. The right V2 is not a shorter
generic lead form. It is the same useful discovery organized into nine
user-perceived stages, with practical details before the final recap and the
existing project-brief preview used as the value payout.

The primary choice should promise what the software demonstrably delivers:

> **Build My First-Quote Game Plan**

“Help me get a fair quote” implies that WindowMan will obtain or calculate a
fair price. The current path does neither. It produces a tailored recommendation,
request checklist, and contractor question, saves the validated intake, and
lets the homeowner select one immutable next step. V2 should make that real
artifact the promise.

## Current executable flow

```text
entry_need_quote
  -> need_reason
  -> adaptive need_detail_*
  -> priorities
  -> stakes (conditional short-path skip exists)
  -> trust
  -> recap / recap correction
  -> ZIP
  -> project_scope
  -> openings
  -> budget
  -> timing
  -> optional first_name
  -> phone
  -> saved lead
  -> post-capture choice
```

### Consumer terminology

- **Brief consumer** means `buildWmChatProjectBrief` uses the answer in the
  visible recommendation, summary, checklist, or key question.
- **Routing consumer** means the answer changes an executable node or canonical
  intent path.
- **Operational consumer** means a current downstream system acts on the field.
  Storing a field in JSON is evidence retention, not operational fulfillment.
- **Measurement value** is analytical value, not an authorization to emit a new
  tracking event.

## Current node and downstream-consumer map

| Stable node / state | Current interaction | Psychological purpose | Collected field | Brief consumer | Routing consumer | Current operational consumer | Measurement value | User benefit / friction | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `entry` / `entry_need_quote` | “Help me get a fair quote” | Self-identification | `entry_intent=need_quote` | Sets starting point and need-quote brief family | Routes to `need_reason`; maps attribution intent to `no_quote` | Canonical lead intake and stored attribution | Primary segment | Clear lane, but “fair quote” overstates outcome | **Preserve ID; replace label** |
| `need_reason` | Why windows or doors now? | Make the consultation feel specific | `need_reason` | Selects the core recommendation/content block and summary | Selects one adaptive detail node | None beyond validated storage | Motivation cohort | High benefit; one tap | **Preserve** |
| `need_detail_moved` | Inspection, age, storm, comfort, remodel, or baseline | Context after a move/purchase | `need_detail` | Adds a tailored requirement and contractor question | Continues to priorities | None beyond storage | Moved-homeowner intent | Specific and easy | **Preserve; conditional** |
| `need_detail_problems` | Drafts, leaks, operation, fogging, damage, heat/noise | Name observed symptoms before product discussion | `need_detail` | Adds symptom-specific requirement/question | Continues to priorities | None beyond storage | Problem cohort | High diagnostic value | **Preserve; conditional** |
| `need_detail_storm` | Insurer question, older product, active damage, preparation, impact uncertainty | Separate evidence/document concerns | `need_detail` | Adds storm-detail guidance without making coverage claims | Continues to priorities | None beyond storage | Storm versus insurer segmentation | Useful, but parent reason combines distinct anxieties | **Preserve; improve framing** |
| `need_detail_remodel` | Whole home, room, larger openings, doors, resale, undecided | Establish design scope | `need_detail` | Adds remodel-specific written-scope guidance | Continues to priorities | None beyond storage | Remodel cohort | High relevance | **Preserve; conditional** |
| `need_detail_comfort` | Heat, energy use, noise, drafts, glare/fading | Anchor the project to an observable outcome | `need_detail` | Adds characteristic-specific requirement/question | Continues to priorities | None beyond storage | Comfort cohort | High relevance without promising performance | **Preserve; conditional** |
| `need_detail_planning` | Baseline, scope, financing, product, timing, where to start | Identify the research job | `need_detail` | Adds planning-specific guidance | May participate in the validated short-path condition | None beyond storage | Early-stage cohort | Good low-pressure lane | **Preserve; conditional** |
| `need_detail_other` | Closest alternate reason | Recover unmatched intent | `need_detail` | Adds the selected detail when mapped | `other_explain` opens text input | None beyond storage | Coverage-gap signal | Prevents forced misclassification | **Preserve; conditional** |
| `need_other_text` | One short sentence | Let an unmatched homeowner explain | `other_text` | Not interpolated into the current brief | Returns to priorities after bounded, PII-screened text | Stored in `wmchat_v1`; no known operator consumer | Taxonomy-learning candidate | Typing friction and privacy risk; capped and screened | **Keep optional; consider removing only after evidence** |
| `priorities` | Choose up to two | Force useful trade-off priorities | `priorities` | Adds summary, first mapped recommendation, and requirements | May trigger the short-path rule with planning/not-sure | None beyond storage | Value hierarchy | Strong value; seven choices plus multi-select cognition | **Preserve; place in a combined guardrails stage** |
| `stakes` | What would bother you most if the project went sideways? | Surface loss aversion without manufacturing fear | `stakes` | Adds a requirement; appears in recap | Continues to trust | None beyond storage | Risk cohort | Useful, but overlaps priorities/trust | **Make conditional / combine visually** |
| `trust` | What makes you cautious about the process? | Address lead-trap and sales-pressure defenses | `trust_concern` | Adds summary and one contractor question | Continues to recap | None beyond storage | Trust-barrier cohort | High CRO value | **Preserve; combine visually** |
| `recap` | Long confirmation of reason/detail/priorities/stakes/trust | Demonstrate listening and allow correction | No new business field; `recap_confirm` or `recap_edit` in path | Gates a coherent intake; brief is not yet shown here | Currently routes to ZIP | None | Confirmation/edit rate | Valuable, but currently creates a false summit | **Move after practical details and pair with brief** |
| `recap_edit_menu` and correction nodes | Choose reason, detail, priorities, stakes, or trust to change | Give control before commitment | Rewrites existing answer/history draft | Rebuilds the corrected brief | Atomically replays canonical history | None | Correction rate and taxonomy quality | High trust; extra steps only when requested | **Preserve as an edit sheet or compact correction mode** |
| `zip` | Required five-digit project ZIP | Add geographic context | `answers.zip` and contact ZIP | Adds ZIP to project summary | Does not currently derive county or change the route | Stored in `wmchat_v1`; top-level `county` remains `null` in the client payload | Geographic cohort | Typing friction; current “stop guessing” reason is weak | **Preserve for v1 contract; move before recap; do not claim live pricing** |
| `project_scope` | Windows, doors, both, or unsure | Bound product family | `project_scope` | Adds summary and scope requirement | Routes to openings | Stored only; top-level `project_type` remains `null` | Project type | Easy tap | **Preserve; combine with openings** |
| `openings` | Range from 1–5 through 20+ or unsure | Establish project magnitude | `openings` | Adds estimated size to summary | Routes to budget | Stored only; top-level `window_count` remains `null` | Size cohort | Easy tap | **Preserve; combine with scope** |
| `budget` | Baseline, financing, ready, researching, unsure | Capture posture without demanding dollars | `budget_posture` | Adds budget posture to summary | Routes to timing | Stored only; top-level `quote_range` remains `null` | Readiness cohort | Lower defensiveness than a price field | **Preserve; combine with timing** |
| `timing` | Urgent, 1–3 months, 3–6 months, no deadline, unsure | Capture project readiness | `timing` | Adds timing to summary | Routes to optional name | Stored only; no proven callback/routing consumer | Readiness cohort | Easy tap | **Preserve; combine with budget** |
| `first_name` | Optional name or Skip | Humanize the saved request | `first_name` | Not used by project brief | Routes to phone | Saved in canonical lead contact when provided | Name completion | Optional but introduces keyboard early | **Move onto contact stage; remain optional** |
| `phone` | Mobile number plus service-contact disclosure | Persist lead identity and continue without re-entry | `phone_e164` after normalization/lookup | Brief preview is rendered immediately before this prompt | Successful capture enters post-capture stage | Canonical lead capture; consent is persisted through the existing boundary | Phone-to-lead conversion | Highest commitment; benefit is visible but privacy reason needs clearer language | **Preserve; combine with optional name only** |
| lead `success` / post-capture `choice` | Saved request, then next-step choices | Convert value into an explicit next intent | Existing trusted lead/session; then post-capture action | Original brief remains reconstructable from `wmchat_v1` | Routes to game plan, quote readiness, or hidden scheduling | One immutable `wmchat_post_capture_v1` write; ready-now scanner is a handoff | Lead-to-continuation and scanner intent | Useful choice, but saved success must not reopen mutable choices later | **Preserve; make saved success terminal** |

### Fields with no proven downstream operational consumer

The following fields are useful to the on-page brief but do not currently drive
a proven CRM, operator, contractor, callback, or pricing workflow:

`need_reason`, `need_detail`, `priorities`, `stakes`, `trust_concern`, `zip`,
`project_scope`, `openings`, `budget_posture`, and `timing`.

That is not a reason to delete them: each contributes to the homeowner's
immediate tailored artifact except `other_text`, whose current value is mainly
context retention. It is a reason not to claim that ZIP produces live local
pricing, timing schedules a callback, opening count produces an estimate, or
the answers are already routed to a contractor. Before adding more fields,
either connect a truthful consumer or demonstrate that the field materially
improves the brief or completion rate.

## Proposed nine-stage target flow

The nine stages below preserve the complete validated information model. A
“stage” is a user-perceived mobile surface, not permission to collapse stable
IDs into an unvalidated object.

| Stage | User experience | Stable data preserved | Value and implementation notes |
| --- | --- | --- | --- |
| 1. Reason | “What started this project?” with the seven current reasons | `need_reason` | Add a quiet correction: “I already have a written quote.” It must switch to the existing quote-holder path through a tested reducer transition, not spoof an answer ID. |
| 2. Reason-specific detail | Render exactly one existing adaptive detail set; show a branch-aware acknowledgement after selection | `need_detail`; optional `other_text` only when selected | For storm/insurance, distinguish “an insurer raised a documentation question” from “I am preparing for storms.” Do not give coverage advice. |
| 3. Project shape | One tactile stage containing scope first, then opening-count range | `project_scope`, `openings` | Keep two discrete reducer selections and validation history even if presented inside one shell. Show local subprogress, not a misleading global step count. |
| 4. Readiness | Timing and budget posture in one stage | `timing`, `budget_posture` | Ask timing before budget posture or visually separate the two groups. Continue to avoid dollar-range entry. |
| 5. Decision guardrails | Priorities (up to two), then conditional “what to avoid,” then trust concern | `priorities`, conditional `stakes`, `trust_concern` | Preserve the current short-path rule. Present as three compact subsections with one active at a time so the user is not shown twenty choices at once. |
| 6. Location | ZIP with a clear reason and visible progress | `zip` | “ZIP helps keep the checklist geographically relevant.” Do not claim current prices, permit verification, availability, or insurer acceptance. Current server validation requires five digits. |
| 7. Final recap and project brief | Show complete answers, correction affordance, then the existing Goal / Scope checklist / Key question preview | No new field; canonical recap confirmation | This removes the false summit. The recap is now the actual end of discovery and pays off the work before contact. |
| 8. Save | Optional first name plus phone, disclosure, concise privacy reassurance, Save CTA | `first_name`, `phone_e164`, existing consent flags | Keep phone lookup distinct from ownership verification. Do not say “verified” unless OTP succeeds in the separate canonical path. |
| 9. Next step | Saved-request confirmation followed by available post-capture actions | Existing lead/session plus one immutable continuation | Keep scheduling hidden until fulfillment exists. Game-plan and review-when-ready must state only what persistence and scanner handoff can prove. A successful continuation is terminal. |

### Contract-safe implementation note

Moving recap after practical details changes the canonical answer-path order. It
cannot be implemented as copy-only work. A later approved sprint must update the
frontend reducer/content tests and the server `wmchatIntake` validator/tests in
one version-compatible change while preserving all answer keys and the
`wmchat_v1` payload shape. Until that protected change is approved, the safe
interim is to keep the order and change recap into an explicit checkpoint with
a truthful “practical details remain” bridge.

Combining controls visually must also preserve discrete reducer commits. A
single React form that bypasses the reducer or submits a parallel payload would
break resume replay and server validation.

## Explicit problem resolutions

### False summit

- **Current:** recap sounds complete, then ZIP plus four tap questions remain.
- **Target:** practical details come first; recap and brief become the real value
  payout immediately before contact.
- **Interim if reordering is deferred:** title the existing recap “Discovery
  checkpoint” and state that practical project details remain.

### Bounded progress

- Use a small stage label such as “Project details · 2 of 4” only inside fixed
  grouped blocks.
- Do not display a global denominator until adaptive and correction paths have a
  tested progress model.
- Announce the new stage heading to assistive technology; progress must not be
  color-only.

### “Fair quote” expectation

- Replace the primary label with **Build My First-Quote Game Plan**.
- Describe the immediate artifact: a tailored request checklist and a question
  to take into contractor conversations.
- Do not claim WindowMan is producing a quote, current market price, guaranteed
  savings, or a number contractors must beat on this path.

### Quote-holder misroute

- Add one quiet text-style affordance on Stage 1: **I already have a written
  quote**.
- Confirm the switch, route to the existing `have_concern` experience, and build
  a canonical `have_quote` answer path.
- Do not show it with equal visual weight to the primary reason choices.

### Storm versus insurance specificity

- Parent framing: **Storm preparation or an insurer question**.
- Detail choices retain the current separation between insurer questions,
  impact-rating uncertainty, active damage, and preparation.
- Acknowledgements should say “documents to request” or “facts to confirm,” not
  whether a product qualifies for coverage or code compliance.

### Trust near phone capture

Place the brief immediately above the contact stage. Add a short factual line
above the existing legal disclosure:

> Your number keeps this WindowMan request connected to your next step. This
> does not verify ownership or book an appointment.

Do not say the number is verified after formatting or Twilio Lookup. Keep the
full service-text and automated-call disclosure unchanged unless a separately
approved consent sprint changes it.

### Plain-refresh resume recovery

- Detect a fresh, valid, non-PII resume snapshot on ordinary entry.
- Offer **Pick up where you left off?** with **Resume** and **Start over**.
- Never silently restore on a shared device.
- Never store phone, name, ZIP text, free text, address, lead ID, or report data
  in the resume snapshot.
- Resume remains a convenience hint, not identity or reveal authorization.

### Immediate artifact

The only confirmed immediate artifact is the on-screen deterministic project
brief preview:

- one goal/recommendation;
- up to three estimate-request checklist items;
- one key contractor question.

V2 should show that artifact at final recap and again at Save. It must not claim
that a PDF, email report, contractor bid, market-price calculation, or callback
has been delivered.

### Truthful post-capture promise

- **Game plan:** save the request to continue building the request plan.
- **Review when ready:** save the homeowner's preferred continuation timing, or
  open the existing secure scanner when the quote is ready now.
- **Scheduling:** remain hidden. A persisted preference without an operator
  consumer is not a scheduled or fulfilled conversation.

## Current-versus-proposed copy

| Surface | Current | Proposed | Why |
| --- | --- | --- | --- |
| Opening headline | “WindowMan: Your Quote Hero” | **Plan Your Window Quote Before You Sign** | Replaces superhero framing with a specific homeowner job and retains pre-signing urgency without fear tactics. |
| Supporting promise | “Tell me what brought you here. I’ll keep the next step simple.” | **WindowMan turns your project priorities into a practical checklist of what to request, compare, and get in writing.** | Names the real output instead of making a vague ease promise. |
| Primary `need_quote` choice | “Help me get a fair quote” | **Build My First-Quote Game Plan** | Matches the deterministic brief instead of implying quote procurement or price fairness. |
| Reason acknowledgement | “Good call… That helps me be useful instead of generic.” | **Good place to start. I’ll shape the checklist around why this project matters now.** | Establishes purpose without self-focused language. Branch-specific acknowledgements follow after the detail selection. |
| Practical-details bridge | “That’s enough for me to stop guessing. What’s the project ZIP?” | **A few practical details will make your checklist more useful. First, what is the project ZIP?** | Removes the false ending and states the homeowner benefit without claiming live pricing. |
| Recap transition | Computed “Let me make sure I have this right…” before practical details | **Here is the project I heard. Review it before I build your first-quote checklist.** | Makes recap the actual conclusion and opens a correction moment. |
| Phone prompt | “Your first-quote game plan is ready. What mobile should I use to save it and continue without making you repeat these answers?” | **Your game-plan preview is ready. Add a mobile number to save this request and keep your answers connected to the next step.** | Distinguishes visible preview from saved request and avoids suggesting ownership verification. |
| Phone reassurance | Existing service-text and automated-call disclosure only | **Your number keeps this WindowMan request connected to your next step. This does not verify ownership or book an appointment.** Keep the existing disclosure immediately below. | Addresses control and expectation without contradicting consent. |
| Save CTA | “Save my project request” | **Save My Game Plan & Continue** | Connects the commitment to the visible artifact. Use only because the intake deterministically rebuilds that brief. |
| Capture confirmation | “Project request received.” / “Your conversation was saved…” | **Your project request is saved. Choose the next step that helps you most.** | Confirms only server success and prepares the immutable next-step decision. |
| Game-plan outcome | “Game-plan request received.” | **Game-plan request saved.** Supporting: **WindowMan saved the project context needed to continue building your request plan.** | “Saved” maps to persistence and does not promise delivery or timing. |

All button labels should use the native system font, a minimum comfortable mobile
size, clear focus state, and tactile blue/neutral depth. Promotional and action
buttons must not use orange. Motion, if added later, must honor reduced-motion
preferences and must not make inactive options appear disabled.

## Measurement plan

The plan has two evidence tiers:

1. **Persisted-funnel reconstruction:** for completed leads, the validated
   `wmchat_v1.answer_path` proves which nodes were completed.
2. **True abandonment:** requires a separately approved operational telemetry
   contract keyed to an opaque session identity. Local React state cannot measure
   people who leave, and browser vendor conversion calls are forbidden.

| Metric | Denominator | Numerator | Authoritative evidence | Current limitation |
| --- | --- | --- | --- | --- |
| Entry-to-reason | `need_quote` path entries | Valid reason selection | Future operational session milestones; persisted answer paths only show completers | Anonymous entrants are not currently server-observable |
| Reason-to-detail | Reason selected | Matching adaptive detail selected | Canonical answer path or approved operational milestones | Persisted records exclude abandoners |
| Detail-to-practical block | Detail selected | First project-shape answer reached | V2 canonical path order plus operational milestones | Must define whether the guardrails stage precedes shape in final implementation |
| Practical block-to-recap | Practical block started | Final recap rendered/confirmed | Canonical answer path for completers; operational milestone for all sessions | Render is not currently persisted |
| Recap-to-phone | Recap confirmed | Phone stage reached/submitted | Operational milestone for reach; capture request for submit | Do not treat an invalid/unsaved phone as a lead |
| Phone-to-persisted lead | Valid phone submission attempted | Trusted server returns lead/session success | `capture-truth-gate-lead` success and the canonical lead row | Browser click is not authoritative |
| Persisted lead-to-persisted continuation | Trusted WmChat lead created | `wmchat_post_capture_v1` inserted | Server RPC outcome and sibling namespace | Replay must not count twice; conflict is not success |
| Scanner handoff-to-upload | Ready-now secure handoff | Canonical scan/upload evidence exists | Server scanner session and private upload records | Navigation alone is not an upload |
| Node-level abandonment | Sessions that reached a node | Sessions that reached its next canonical node within an approved window | Future operational telemetry plus canonical path model | Cannot be derived for abandoners from local resume or completed leads alone |

### Measurement rules

- Business conversion evidence must be server-authoritative after persistence.
- Operational node telemetry, if approved, belongs in the internal telemetry
  lane and must not be promoted to Meta/OpenAI/GTM conversion truth.
- Never include answer text, phone, name, ZIP, address, or project details in an
  event payload.
- Use deterministic deduplication for persisted business milestones.
- A replay is not another conversion; a conflict is not success.
- Keep `/wmchat` browser page-measurement suppression unless a separate Tier C
  measurement sprint explicitly changes it.

## Suggested implementation slicing

This document does not authorize these edits. It recommends three separately
reviewable increments after current reliability and measurement work merges:

1. **Expectation and recovery:** primary label/promise, reason-stage quote-holder
   correction, phone reassurance, and opt-in resume offer. Preserve path order.
2. **Grouped presentation:** project-shape, readiness, and guardrails shells with
   exact stable reducer selections and accessibility tests.
3. **Canonical reorder:** move practical details before recap/brief through a
   coordinated frontend reducer plus server validator change, with replay,
   resume, payload, and Edge contract tests.

Do not combine this redesign with scanner, OTP, reveal, consent, tracking,
migration, or callback fulfillment changes.

## Acceptance criteria for a later implementation

- All existing answer keys survive or are deliberately versioned server-side.
- The server validates the exact new canonical path.
- The brief consumes the same project facts and renders before phone capture.
- A quote-holder can recover from the wrong entry choice without an invalid
  answer path.
- The progress cue is accurate for adaptive and correction paths.
- Plain refresh offers, rather than forces, safe resume.
- Phone copy does not say “verified” before OTP.
- No price, savings, insurance, legal, fulfillment, or appointment promise is
  unsupported.
- Scheduling remains hidden until a durable operator consumer exists.
- A successful immutable continuation cannot return to mutable choices.
- No browser vendor conversion call is added.
- 360–430 px mobile layout, keyboard focus, screen-reader announcements,
  reduced motion, and existing tactile no-orange visual direction pass QA.
