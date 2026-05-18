# AGENTS.md — WindowMan.PRO

## 1) Mission
WindowMan.PRO is a **post-quote intelligence system** for Florida impact window/door homeowners.

It is **not**:
- a generic lead-gen page
- a contractor directory
- a content-heavy blog
- a fake AI demo

### Core framing
- **Public Page = Acquisition**
- **Vault = Product**
- **Truth Report = Asset**

### North star
Be the **Carfax for impact window quotes**.

---

## 2) Current Sprint (Strict Priority)
Build only in this order:

1. **Adaptive Acquisition Page**
2. **Scanner Brain**
3. **Database + Persistence**
4. **SMS OTP Hard Gate**
5. **Truth Report Reveal**
6. **Contractor Handoff Logic**

### Do not build yet
- full contractor portal
- feature-rich dashboard sprawl
- content expansion
- broad account/settings work
- comparison tools unless required by the sprint

If a task does not help the current sprint, **defer it**.

---

## 3) Non-Negotiable Rules
1. **Do not send `full_json` to the client before SMS verification.**
2. **Do not use AI/LLM output as the final scoring authority.**
3. **Do not store quote files in public buckets.**
4. **Do not weaken RLS for convenience.**
5. **Do not force verified return users back to the marketing hero.**
6. **Do not build fake UI that implies real functionality.**
7. **Do not replace the SMS hard gate with magic link access to the full report.**

If a proposed change violates any rule above, **reject it**.

---

## 4) Identity Ladder (Core Moat)
### Level 0 — Anonymous
Allowed:
- upload quote
- see proof-of-read
- see safe teaser / locked preview

Blocked:
- full grade
- exact score
- full red flags
- contractor-sensitive intelligence

### Level 1 — Account / Email
Allowed:
- session persistence
- dashboard access
- “report pending” or teaser state

Blocked:
- full Truth Report

### Level 2 — SMS Verified
Required for access to:
- full Truth Report
- exact grade
- pillar breakdown
- full red flags
- contractor handoff request

### Guardrail
Access to the full report is controlled by backend verification state such as:
- `phone_verified_at != null`

Never fake this with blur, hidden DOM, or client-only conditionals.

---

## 5) Scanner Brain Rule
### Separation of concerns
**AI extracts. TypeScript scores.**

### AI/LLM layer may:
- OCR documents
- extract raw fields
- normalize quote data into strict JSON
- identify likely missing sections

### TypeScript scoring layer must:
- assign overall grade
- calculate 5 pillar scores
- assign red flags
- determine severity
- build preview/reveal payloads

### 5 pillars
- Safety & Code Match
- Install & Scope Clarity
- Price Fairness
- Fine Print & Transparency
- Warranty Value

### Missing-data rule
Missing technical or scope information is a **red flag**, not a blank field.

---

## 6) Required Architecture
### Stack
- Lovable frontend
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Twilio Verify
- secure backend / edge functions
- deterministic TypeScript scoring utilities

### Storage
- quote files must be stored in **private buckets**
- access only through signed URLs when needed

### Auth / verification
- Twilio secrets stay backend-only
- OTP send/verify logic runs server-side
- full report fetch must check verified state first

### Persistence
At minimum persist:
- lead
- upload
- scan session
- analysis
- report
- verification state
- contractor handoff intent

---

## 7) Minimum Data Model
Use these core entities:
- `profiles`
- `leads`
- `quote_uploads`
- `scan_sessions`
- `analyses`
- `reports`
- `phone_verifications`
- `contractor_handoffs`
- `event_logs`

### Analysis/report objects should support:
- `proof_of_read`
- `preview_json`
- `full_json`
- `rubric_version`
- `confidence_score`
- `analysis_status`
- `user_id`
- timestamps

---

## 8) Route Rules
### Public
- `/`
- `/signin`
- `/signup`
- `/verify`
- `/demo`
- `/visual/*` — **mock-only UI harnesses** (e.g. `/visual/report-preview`, `/visual/pre-upload-intake`). No production funnel, no backend full-report reveal. Intentionally **not** wrapped in `isDevMode` so cloud staging and Lovable preview can QA layouts without a dev build flag.
- `/sandbox/*` — related **UI-only** harness paths when enabled (e.g. `/sandbox/intake`, `/sandbox/report-preview`). Same mock/QA purpose as visual lab; may remain `isDevMode`-gated in `App.tsx` while `/visual/*` stays always public.

### Authenticated
- `/vault`
- `/vault/upload`
- `/vault/reports/:reportId`

### Navigation
Main header stays minimal:
- logo
- sign in
- create account
- dashboard/resume
- upload quote

Do not place About, FAQ, Contact, Privacy, Terms, or Disclaimer in the main nav.
Put them in the footer only.

---

## 9) UX / CRO Rules
### Acquisition page must serve 4 states
- user has quote
- user has no quote
- returning unverified user
- returning verified user

### Teaser rule
Before SMS verification, show enough value to increase unlock intent:
- proof the file was read
- locked preview
- warning count bucket
- partial result framing

But do **not** expose enough to reconstruct the report.

### Return-user rule
If a user returns and is authenticated, route them to:
- dashboard
- report
- resume state

Not the generic hero.

### Product feel
Must be:
- premium
- fast
- trustworthy
- mobile-first
- focused

Not:
- noisy
- gimmicky
- overstuffed
- content-bloated

---

## 10) Failure Handling
If OCR/extraction is weak, do not fake certainty.

Use controlled states such as:
- `needs_better_upload`
- `unreadable_quote`
- `manual_review_pending`

If critical specs are missing, render an explicit red flag:
- DP rating not shown
- permit handling unclear
- warranty scope unclear
- product approval not listed

---

## 11) Analytics Rules
Optimize for **verified quote-owner behavior**, not vanity leads.

Track:
- `page_view`
- `cta_click`
- `path_selected`
- `lead_started`
- `upload_started`
- `upload_completed`
- `teaser_viewed`
- `otp_started`
- `otp_verified`
- `report_revealed`
- `contractor_match_requested`
- `qualified_lead`

Highest-value signals:
- quote uploaded
- OTP verified
- report revealed
- contractor handoff requested

---

## 12) Definition of Done
A task is not done unless all relevant checks pass:

- [ ] Full report is still backend-gated
- [ ] Score is computed by deterministic code, not LLM output
- [ ] Quote files remain private
- [ ] RLS is preserved
- [ ] Lead/scan/report state persists correctly
- [ ] Returning-user routing still works
- [ ] Mobile UX remains clean
- [ ] Main CTA path is stronger or unchanged

---

## 13) Agent Decision Policy
When uncertain, prefer the option that:
1. protects the moat
2. preserves SMS-gated reveal
3. improves deterministic scoring integrity
4. reduces funnel leakage
5. strengthens acquisition clarity
6. avoids feature sprawl

### One-line reminder
WindowMan.PRO converts homeowner quote uncertainty into a **verified, high-intent, monetizable lead** using a **server-gated Truth Report**, an **Identity Ladder**, and a **deterministic Scanner Brain**.
