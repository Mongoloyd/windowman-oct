Approved. Implement the admin-only Lead Evidence Inspector exactly as planned.

Allowed files only:

- src/routes/AdminRoutes.tsx

- src/services/adminDataService.ts

- src/pages/AdminLeadEvidence.tsx

- supabase/functions/admin-data/index.ts

Goal:

Create a read-only admin ops/debugging page at /admin/lead-evidence that lets an admin select a lead and inspect the evidence chain:

lead -> quote_files -> scan_sessions -> analyses -> existing admin report links

This is not a homeowner feature, not a replacement Lead Inbox, not an AdminDashboard tab, and not a public route.

Implementation preflight:

- Schema verification is an implementation preflight only.

- Do not add a runtime schema preflight endpoint, script, or user-facing schema checker.

- Before coding the backend action, verify the actual available columns on:

  - leads

  - quote_files

  - scan_sessions

  - analyses

- Do not invent relationships.

- If quote_files.lead_id is not reliable, resolve quote files through scan_sessions.quote_file_id.

- Confirm supabase/config.toml remains unchanged and already has explicit verify_jwt=false blocks for all local Edge Functions.

Backend requirements:

- Implement a new read-only fetch_lead_evidence action inside the existing admin-data Edge Function.

- Keep existing fetch_quote_evidence unchanged.

- Use existing admin role validation.

- Roles allowed: super_admin, operator, viewer.

- Require and validate lead_id.

- Fetch the selected lead first with a narrow column list.

- Return a sanitized 404/not_found response if the lead does not exist.

- Return a sanitized unauthorized response if role validation fails.

- Query only evidence for the selected lead.

- Limit returned rows:

  - quote_files: newest 5

  - scan_sessions: newest 25

  - analyses: newest 25

- Generate signed URLs backend-side only, using the private quotes bucket signed URL API.

- Generate signed URLs only for quote files returned for the selected lead.

- If signing fails for one file, return that file with:

  - signed_url: null

  - signed_url_error: "signing_failed"

  and continue returning the rest.

Backend safety rules:

- fetch_lead_evidence must perform no writes, updates, deletes, rescans, tracking events, routing actions, lead status changes, or report reveal changes.

- Do not select, return, or render analyses.full_json.

- Do not return or render raw OCR text.

- Only return lightweight summaries from flags, preview_json, and proof_of_read.

Frontend service requirements:

- In src/services/adminDataService.ts:

  - add fetch_lead_evidence to the AdminAction union.

  - add payload type: fetch_lead_evidence: { lead_id: string }.

  - add LeadEvidenceResponse interfaces.

  - add fetchLeadEvidence(leadId) wrapper.

  - keep fetchQuoteEvidence unchanged.

- Do not query quote_files, scan_sessions, or analyses directly from browser code.

- Use invokeAdminData() for admin-data calls.

Page requirements:

- Create src/pages/AdminLeadEvidence.tsx.

- Use existing admin UI patterns.

- Use existing fetch_leads / invokeAdminData path for the lightweight lead list.

- Do not fetch quote_files, scan_sessions, or analyses during initial page load.

- Fetch evidence only after a specific lead is selected.

- Show these states:

  - no selected lead

  - loading

  - empty

  - error with retry

  - not found

  - unauthorized

- Link to existing /admin/leads/:id.

- Link to existing /admin/leads/:id/report only when report context exists.

- Do not create a duplicate full report viewer.

- Do not create a replacement Lead Inbox.

Page content:

- Lead summary:

  - lead ID

  - created/updated timestamps

  - name

  - email

  - phone

  - city/county/state/zip

  - latest scan session ID

  - latest analysis ID

  - grade/status

- Quote files:

  - ID

  - storage_path as text metadata only

  - status

  - created date

  - related scan session ID when resolvable

  - signed URL button/link only if backend returned signed_url

  - signed URL expiry

  - generic signing failure/null state when signing failed

- Scan sessions:

  - ID

  - lead ID

  - quote file ID

  - status

  - created/updated timestamps

- Analyses:

  - ID

  - lead ID

  - scan session ID

  - grade

  - analysis status

  - confidence score

  - rubric version

  - document type

  - window/door related boolean

  - dollar delta

  - created/updated timestamps

  - flags summary

  - preview/proof presence summaries only

Error handling:

- The page must show clear sanitized user-visible error states when:

  - the lead list cannot load

  - selected lead evidence cannot load

  - the selected lead does not exist

  - the current admin role is not authorized

  - signed URL generation fails for a quote file

- Error messages must be useful but sanitized:

  - no stack traces

  - no service-role details

  - no secret names/values

  - no raw Supabase internals

  - no raw storage signing errors in the UI

  - use a generic signing error such as "signing_failed"

- Technical details may be logged to console for debugging.

Routing requirements:

- In src/routes/AdminRoutes.tsx:

  - add lazy import for AdminLeadEvidence.

  - add explicit protected route /admin/lead-evidence.

  - wrap it with AdminAuthGate.

  - place it above the dynamic /admin/:tab route.

- Do not add it to adminDashboardTabs.ts.

- Do not add a root alias.

- Do not create a public route.

- Do not add it as an AdminDashboard tab.

- Do not modify src/App.tsx.

Do not modify:

- src/components/AdminDashboard.tsx

- src/routes/adminDashboardTabs.ts

- admin tab components

- src/App.tsx

- supabase/config.toml

- migrations

- RLS

- storage policies

- scanner/scan-quote

- OTP/Twilio

- report reveal/full_json gating

- tracking/Meta CAPI/analytics

- package files

- Vite files

- homepage

- partner routes/pages

- public routes

- public contractor routes

Stop conditions:

- Stop if broader changes are required.

- Stop if TypeScript requires broad refactoring outside the allowed files.

- Stop if schema verification shows required columns do not exist and no safe existing relationship can resolve the evidence chain.

- Stop if any change to supabase/config.toml appears necessary.

- Stop if implementation requires database migrations, RLS changes, storage policy changes, public storage URLs, scanner changes, OTP/Twilio changes, report reveal changes, tracking changes, package changes, Vite changes, public route changes, or partner route changes.

Verification required:

1. Changed files are exactly:

   - src/routes/AdminRoutes.tsx

   - src/services/adminDataService.ts

   - src/pages/AdminLeadEvidence.tsx

   - supabase/functions/admin-data/index.ts

2. /admin/lead-evidence loads behind AdminAuthGate.

3. /admin/lead-evidence is explicit and above /admin/:tab.

4. src/App.tsx remains unchanged.

5. src/routes/adminDashboardTabs.ts remains unchanged.

6. supabase/config.toml remains unchanged.

7. Existing routes still work:

   - /admin/leads

   - /admin/leads/:id

   - /admin/leads/:id/report

   - /admin/readiness

   - /admin/lifecycle

8. Lead list loads through existing fetch_leads / invokeAdminData path.

9. No quote_files, scan_sessions, or analyses are fetched during initial list load.

10. Selecting a lead calls fetch_lead_evidence through invokeAdminData.

11. Empty quote_files, scan_sessions, or analyses states do not crash.

12. Missing lead shows sanitized not-found state.

13. Unauthorized role shows sanitized unauthorized state.

14. Quote file rows show signed links only when backend returns signed_url.

15. Signed URL failure does not crash the page.

16. analyses.full_json is not selected, returned, or rendered.

17. Raw OCR text is not shown.

18. fetch_quote_evidence remains unchanged.

19. No protected systems changed.

Final report:

- exact files changed

- schema verification summary

- backend action added

- frontend wrapper added

- route added

- signed URL behavior

- error handling behavior

- confirmation fetch_quote_evidence remained unchanged

- confirmation protected systems remained unchanged

- safe to publish or stop recommendation