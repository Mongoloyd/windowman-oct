WindowMan Partner Mini-CRM & Lead Management System
Product Specification
Prioritized Feature Spec · API Schemas · Data Model · Sprint Plan
Version: 1.0   |   Date: April 24, 2026
Audience: Engineering, Product, Design, QA
Classification: Internal — Confidential

Table of Contents
●	1. Executive Summary
●	2. Prioritized Feature Roadmap
○	2.1 MVP (Sprints 1–3) — P0 Features
○	2.2 Phase 2 (Sprints 4–5) — P1 Features
○	2.3 Phase 3 (Sprint 6+) — P2 Features
●	3. Acceptance Criteria
○	3.1 Three-Page Navigation Shell
○	3.2 Lead Record
○	3.3 Kanban Board
○	3.4 Lead Dossier
○	3.5 Edge Function / Status Change Event
○	3.6 Sold Won Conversion Events
○	3.7 Filters
○	3.8 RBAC
○	3.9 Bulk Actions
○	3.10 Command Center
○	3.11 Stripe Billing
○	3.12 Twilio / Call Recording
○	3.13 Transcription & Sentiment
○	3.14 AI Voice Bot
●	4. API Event Schemas (JSON)
○	4.1 Status Change Event Payload
○	4.2 Sold Won Conversion Event — Meta Conversions API
○	4.3 Sold Won Conversion Event — Google Ads Offline Conversion
○	4.4 Webhook Delivery Envelope
○	4.5 Edge Function Trigger Schema (Supabase)
●	5. Minimal Data Model
○	5.1 Entity: leads
○	5.2 Entity: partners
○	5.3 Entity: companies
○	5.4 Entity: lead_status_events
○	5.5 Entity: activity_log
○	5.6 Entity: conversion_events
○	5.7 Entity: call_records
○	5.8 Entity: billing_events
○	5.9 Entity: redistribution_rules
○	5.10 Enums
○	5.11 Relationships
●	6. UI/UX Requirements & Wireframe Notes
○	6.1 Global Navigation
○	6.2 Leads List Page
○	6.3 Lead Dossier Page
○	6.4 Command Center Page
●	7. Security, Compliance & Operational Notes
○	7.1 RBAC Matrix
○	7.2 Recording Consent
○	7.3 Data Retention
○	7.4 Security
●	8. Sprint Plan (6 × 2-Week Sprints)
○	Sprint 1: Foundation & Navigation
○	Sprint 2: Kanban, Lead Dossier & Quick Actions
○	Sprint 3: Edge Functions, Conversion Events & Filters
○	Sprint 4: Bulk Actions, Command Center & Redistribution
○	Sprint 5: Stripe Billing & Twilio Integration
○	Sprint 6: Transcription, Sentiment, AI Bot & Polish
●	9. Appendix
○	9.1 Status Transition Matrix
○	9.2 Environment Variables Required
○	9.3 Glossary

1. Executive Summary
WindowMan is a B2B SaaS platform that distributes homeowner leads to partner contractors via a mobile-first mini-CRM. The system is organized around three core pages — Leads List, Lead Dossier, and Command Center — connected by a persistent bottom tab bar navigation.
Partners receive leads representing homeowners interested in window replacement services. They manage these leads through a Kanban-style board interface, advancing leads through a defined status lifecycle from initial contact through to a closed sale (sold_won) or loss (lost). Each status change is captured by an edge function that produces a structured event payload, enabling downstream integrations.
Key integration points include:
●	Meta Conversions API & Google Conversion API — Conversion events are fired on sold_won status changes to enable ad platform optimization and attribution.
●	Stripe — Weekly invoicing based on the count of sold_won events per billing period per partner company.
●	Twilio — Dynamic Number Insertion (DNI), call recording with consent, in-app playback, and AI outbound voice bot capabilities.
The platform enforces Role-Based Access Control (RBAC) across four roles: partner, admin, windowman, and auditor. Row-Level Security (RLS) is implemented at the database layer via Supabase to ensure data isolation. The system maintains compliance through recording consent enforcement, data retention policies, and a comprehensive audit trail.

Key Design Principles
•  Mobile-first — All interfaces are designed for 375px minimum width with touch-friendly targets.
•  Event-driven — Every status change produces an immutable event record that drives integrations, billing, and audit.
•  Leads belong to the company, not the partner — Leads can be reassigned and redistributed based on SLA rules.
•  Idempotent by design — All conversion events and webhooks use idempotency tokens to prevent duplicate processing.


2. Prioritized Feature Roadmap
2.1 MVP — Sprints 1–3 (P0 Features)
These features are required for the minimum viable product. No feature in this tier is deferrable.

Priority	Feature	Description
P0	Three-Page Navigation Shell	Persistent bottom tab bar with three pages: Leads List, Lead Dossier, Command Center. Page labels visible at all times. Mobile-first responsive layout (375px minimum).
P0	Lead Record Data Model	Homeowner fields: first_name, last_name, full address (street, city, state, zip), contact info (phone, email), multi-line notes, disposition/status enum, created_at, updated_at, assigned_partner_id.
P0	Lead Status Lifecycle	Status enum: new → contacted → appointment_set → booked → sold_won → lost. Additional statuses: canceled, no_show, rescheduled, follow_up. Validated transitions enforced server-side.
P0	Kanban Board View	Kanban board on Leads List page with columns mapped to status values. Drag-and-drop to change status. Optimistic UI with rollback on failure.
P0	Lead Dossier Page	Full lead detail view with click-to-call, click-to-email, click-to-SMS quick actions. Editable status, notes, and conversion value.
P0	Activity Timeline	Chronological log on Lead Dossier of all status changes, notes, calls, and emails. Reverse chronological, grouped by date.
P0	Edge Function (Status Change)	Fires on every status change. Produces event payload with lead_id, partner_id, old_status, new_status, timestamp, conversion_value (nullable), currency, idempotency_token.
P0	Sold Won Conversion Events	On status change to sold_won, send conversion events to Meta Conversions API and Google Conversion API with numeric conversion_value.
P0	Filters on Leads List	Filter by status (multi-select), date range (created_at), and assigned partner. Composable AND logic. Active filter indicators.
P0	RBAC	Four roles: partner, admin, windowman, auditor. Row-Level Security on all tables. Role-based UI visibility controls.

2.2 Phase 2 — Sprints 4–5 (P1 Features)

Priority	Feature	Description
P1	Bulk Actions	Multi-select on Leads List with bulk status change, bulk reassign, and export. Each bulk status change fires individual edge function events.
P1	Master Command Center	Dashboard highlighting lost/stale leads, redistribution rules, SLA tracking. KPI cards for total, active, sold won, lost, and stale leads.
P1	Lead Redistribution	Leads owned by company, reassignable after SLA expiry. Configurable redistribution rules with fallback partner assignment.
P1	Stripe Billing	Weekly invoicing (Monday 00:00 UTC) based on sold_won event count × per-lead price. Invoice created in Stripe, linked to partner's Stripe customer ID.
P1	Twilio DNI	Dynamic Number Insertion — replaces displayed phone number with a Twilio tracking number for call attribution. Optional for MVP.
P1	Call Recording	Call recording via Twilio with consent prompt at start of call. In-app playback with standard audio controls. Encrypted storage at rest.
P1	Conversion Event Delivery	Delivery confirmation and retry logic for conversion events. Exponential backoff with max 3 retries. Audit logging of all delivery attempts.

2.3 Phase 3 — Sprint 6+ (P2 Features)

Priority	Feature	Description
P2	Call Transcription	Speech-to-text transcription of call recordings, generated within 5 minutes of call completion. Searchable from Lead Dossier.
P2	Sentiment Analysis	Sentiment classification (positive, neutral, negative) on call transcriptions. Displayed as a badge on Lead Dossier.
P2	AI Outbound Voice Bot	One-click outbound calls from Lead Dossier using configurable call scripts. Recording, transcription, and timeline logging apply.
P2	Advanced Command Center Analytics	Conversion funnels, partner performance scoring (conversion rate, average time-to-close, lead volume).
P2	Data Retention Policies	Automated purge schedules for leads (7 years), recordings (2 years), transcriptions (2 years). Configurable per company.
P2	Region-Based Compliance	Recording consent checks based on state regulations (one-party vs. two-party consent). Automatic enforcement based on lead address.


3. Acceptance Criteria
Each feature below includes pass/fail acceptance criteria. All criteria must pass for the feature to be considered complete.
3.1 Three-Page Navigation Shell
1.	AC-1: Bottom tab bar is visible on all three pages with labels "Leads", "Lead Detail", and "Command Center".
2.	AC-2: The active page tab is visually highlighted with the brand accent color and distinct from inactive tabs.
3.	AC-3: Navigation persists across page transitions without triggering a full page reload (SPA behavior).
4.	AC-4: Layout is mobile-first; all content is fully usable and readable at 375px viewport width without horizontal scrolling.
3.2 Lead Record
5.	AC-1: All required fields (first_name, last_name, phone, email, street, city, state, zip) are validated on create and edit. Missing or invalid values return a 422 with field-level error messages.
6.	AC-2: Notes field supports multi-line input with a minimum capacity of 500 characters. Longer inputs are accepted up to the TEXT column limit.
7.	AC-3: Status field only accepts values from the approved lead_status_enum. Any other value returns a 422 error.
8.	AC-4: created_at is set automatically on record creation and never changes. updated_at is set automatically on every update.
3.3 Kanban Board
9.	AC-1: Columns render for each active status value in the lead_status_enum, in the defined lifecycle order.
10.	AC-2: Drag-and-drop of a card from one column to another triggers a status change API call. Only valid transitions (per the transition matrix) are accepted; invalid drops are rejected with a visual error indicator.
11.	AC-3: Kanban view updates optimistically — the card moves immediately. On API failure, the card rolls back to its original column and a toast notification displays the error.
12.	AC-4: Each card displays the lead name, phone number, status badge, and time-in-status (e.g., "3d 4h").
3.4 Lead Dossier
13.	AC-1: Click-to-call initiates a tel: link on mobile devices or triggers a Twilio-initiated call on desktop browsers.
14.	AC-2: Click-to-email opens a mailto: link or an in-app compose modal.
15.	AC-3: Click-to-SMS opens an sms: link on mobile devices or an in-app compose modal on desktop.
16.	AC-4: Activity timeline shows all events in reverse chronological order, grouped by date.
17.	AC-5: Each timeline entry shows event type (with icon), timestamp, actor name, and detail text (e.g., "Status changed from contacted to booked").
3.5 Edge Function / Status Change Event
18.	AC-1: Every status change produces exactly one event payload in the lead_status_events table. No duplicates, no missing events.
19.	AC-2: Payload includes: lead_id (UUID), partner_id (UUID), old_status (enum), new_status (enum), timestamp (ISO 8601), conversion_value (numeric, nullable), currency (ISO 4217, default "USD"), idempotency_token (UUID v4).
20.	AC-3: Idempotency token is unique per event and prevents duplicate processing on retry. Resubmitting the same token results in a no-op or 409 Conflict.
21.	AC-4: Edge function completes within 500ms at p95 latency.
3.6 Sold Won Conversion Events
22.	AC-1: Status change to sold_won triggers a conversion event to the Meta Conversions API with the correct schema (see Section 4.2).
23.	AC-2: Status change to sold_won triggers a conversion event to the Google Ads Offline Conversion API with the correct schema (see Section 4.3).
24.	AC-3: conversion_value is a positive numeric value representing the contract value in USD. A zero or negative value is rejected at the API layer.
25.	AC-4: Events include partner_id and lead_id for attribution, passed as custom variables / custom data.
26.	AC-5: Failed delivery is retried with exponential backoff: delays of 1s, 4s, 16s (max 3 retries). After 3 failures, the event is marked as failed.
27.	AC-6: All conversion events (successful and failed) are logged in the conversion_events audit table with full request payload, response status, and response body.
3.7 Filters
28.	AC-1: Leads List supports filter by status (multi-select from enum values), date range (created_at start/end), and assigned partner (dropdown).
29.	AC-2: Filters are composable using AND logic. Applying status = "contacted" AND partner = "Partner A" returns only leads matching both criteria.
30.	AC-3: Active filters are visually indicated with a count badge on the filter bar (e.g., "Filters (3)").
31.	AC-4: "Clear All" button resets all filters to the default view (all statuses, all dates, all partners).
3.8 RBAC
32.	AC-1: partner role can view and edit only leads assigned to their own company (assigned_company_id matches their company_id).
33.	AC-2: admin role can view all leads across all companies and can reassign leads between partners within their own company.
34.	AC-3: windowman role has full system access including all leads, billing configuration, user management, and integration settings.
35.	AC-4: auditor role has read-only access to all data including audit logs, billing records, and activity logs. No create, update, or delete permissions.
36.	AC-5: Any unauthorized access attempt returns HTTP 403 Forbidden and creates an entry in the audit log with the requesting user ID, attempted action, and timestamp.
3.9 Bulk Actions
37.	AC-1: Multi-select is enabled via a checkbox on each lead card/row in the Leads List.
38.	AC-2: "Select All" selects all visible (currently filtered) leads. A count indicator shows "N selected".
39.	AC-3: Bulk status change applies the new status to all selected leads and fires individual edge function events for each lead. Invalid transitions are skipped with an error summary.
40.	AC-4: Bulk reassign changes assigned_partner_id for all selected leads and logs a reassigned activity entry for each.
3.10 Command Center
41.	AC-1: Dashboard shows KPI cards with counts: lost leads, stale leads (no activity exceeding SLA threshold), and leads pending redistribution.
42.	AC-2: Redistribution rules are configurable: SLA hours threshold, trigger status, fallback partner. Rules can be enabled/disabled with a toggle.
43.	AC-3: One-click reassign from the stale leads table moves the lead to the fallback partner and logs the action.
3.11 Stripe Billing
44.	AC-1: Weekly billing cycle runs automatically every Monday at 00:00 UTC.
45.	AC-2: Invoice amount = count of sold_won events in the billing period (Monday 00:00 UTC to Sunday 23:59:59 UTC) × per-lead price configured in STRIPE_PRICE_ID.
46.	AC-3: Invoice is created in Stripe and linked to the partner company's stripe_customer_id. Stripe invoice ID is stored in billing_events.
47.	AC-4: Billing history is visible to partner (own company only), admin (own company only), windowman (all companies), and auditor (all companies, read-only).
3.12 Twilio / Call Recording
48.	AC-1: DNI replaces the displayed phone number with a Twilio tracking number tied to the lead and partner for call attribution.
49.	AC-2: Call recording starts only after a consent prompt is played ("This call may be recorded for quality assurance") and the callee does not opt out.
50.	AC-3: Recordings are stored in secure cloud storage (e.g., Supabase Storage or S3) with encryption at rest (AES-256).
51.	AC-4: In-app playback provides standard audio controls: play, pause, seek (progress bar), and volume. Duration and timestamp are displayed.
3.13 Transcription & Sentiment
52.	AC-1: Transcription is generated within 5 minutes of call completion and stored in call_records.transcription.
53.	AC-2: Sentiment score (positive, neutral, negative) is attached to each transcription and displayed as a color-coded badge on the Lead Dossier.
54.	AC-3: Transcription text is full-text searchable from the Lead Dossier search interface.
3.14 AI Voice Bot
55.	AC-1: Outbound bot calls are initiated from the Lead Dossier with a single click. The user confirms before the call is placed.
56.	AC-2: Bot follows configurable call scripts stored in the database. Scripts are editable by windowman role.
57.	AC-3: Call recording and transcription pipelines apply to bot calls identically to human calls. is_bot_call is set to true.
58.	AC-4: Bot call results (duration, outcome, transcription) are logged in the activity timeline with a distinct "bot_call" activity type.

4. API Event Schemas (JSON)
All schemas below are normative. Implementations must conform to these structures exactly. Field names are snake_case. All UUIDs are v4. All timestamps are ISO 8601 in UTC.
4.1 Status Change Event Payload
Produced by the edge function on every lead status change.
{   "event_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",   "event_type": "lead.status_changed",   "lead_id": "f7e6d5c4-b3a2-4190-8081-7263544536f7",   "partner_id": "d4c3b2a1-0f9e-4d8c-7b6a-5948372615d4",   "old_status": "contacted",   "new_status": "booked",   "timestamp": "2026-04-24T14:30:00Z",   "conversion_value": null,   "currency": "USD",   "idempotency_token": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",   "metadata": {     "changed_by": "d4c3b2a1-0f9e-4d8c-7b6a-5948372615d4",     "changed_by_role": "partner",     "source": "kanban_drag",     "ip_address": "192.168.1.1"   } }

Field	Type	Required	Description
event_id	UUID v4	Yes	Unique identifier for this event record
event_type	String	Yes	Always "lead.status_changed"
lead_id	UUID v4	Yes	The lead whose status changed
partner_id	UUID v4	Yes	The partner currently assigned to the lead
old_status	lead_status_enum	Yes	Previous status (null for initial creation)
new_status	lead_status_enum	Yes	New status after the change
timestamp	ISO 8601 (UTC)	Yes	When the status change occurred
conversion_value	Numeric / null	No	Contract value in USD; populated only on sold_won
currency	ISO 4217	Yes	Default: "USD"
idempotency_token	UUID v4	Yes	Unique token to prevent duplicate processing
metadata	Object	Yes	Context: actor ID, role, source (UI element), IP

4.2 Sold Won Conversion Event — Meta Conversions API
Sent to https://graph.facebook.com/v19.0/{PIXEL_ID}/events when a lead transitions to sold_won.
{   "data": [     {       "event_name": "Purchase",       "event_time": 1745500200,       "event_id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",       "event_source_url": "https://app.windowman.com/leads/f7e6d5c4-b3a2-4190-8081-7263544536f7",       "action_source": "system_generated",       "user_data": {         "em": ["a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"],         "ph": ["c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4"],         "fn": ["d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5"],         "ln": ["e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6"],         "ct": ["f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7"],         "st": ["a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"],         "zp": ["b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9"],         "country": ["us"],         "external_id": ["f7e6d5c4-b3a2-4190-8081-7263544536f7"]       },       "custom_data": {         "currency": "USD",         "value": 12500.00,         "content_name": "window_replacement",         "content_category": "home_improvement",         "partner_id": "d4c3b2a1-0f9e-4d8c-7b6a-5948372615d4",         "lead_id": "f7e6d5c4-b3a2-4190-8081-7263544536f7"       }     }   ] }

Important: PII Hashing
All user_data fields (em, ph, fn, ln, ct, st, zp) must be SHA-256 hashed before sending. Values must be lowercased, trimmed, and hashed individually. The external_id field is sent as-is (unhashed lead UUID).

4.3 Sold Won Conversion Event — Google Ads Offline Conversion
Sent via the Google Ads API ConversionUploadService.UploadOfflineConversions endpoint.
{   "conversions": [     {       "gclid": "EAIaIQobChMI_example_gclid_value",       "conversion_action": "customers/1234567890/conversionActions/987654321",       "conversion_date_time": "2026-04-24 14:30:00-04:00",       "conversion_value": 12500.00,       "currency_code": "USD",       "order_id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",       "external_attribution_data": {         "external_attribution_credit": 1.0,         "external_attribution_model": "DATA_DRIVEN"       },       "custom_variables": [         {           "conversion_custom_variable": "customers/1234567890/conversionCustomVariables/111",           "value": "d4c3b2a1-0f9e-4d8c-7b6a-5948372615d4"         },         {           "conversion_custom_variable": "customers/1234567890/conversionCustomVariables/222",           "value": "f7e6d5c4-b3a2-4190-8081-7263544536f7"         }       ]     }   ] }

Note: GCLID Availability
The gclid field is populated only if the lead originated from a Google Ads click. If unavailable, the conversion is uploaded using enhanced conversions with user_identifiers (hashed email, phone) instead of gclid. The order_id maps to the idempotency_token to prevent duplicate uploads.

4.4 Webhook Delivery Envelope
Wraps event payloads for external webhook delivery to partner-configured endpoints.
{   "webhook_id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",   "webhook_type": "lead.status_changed",   "created_at": "2026-04-24T14:30:00Z",   "delivery_attempt": 1,   "max_retries": 3,   "payload": {     "event_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",     "event_type": "lead.status_changed",     "lead_id": "f7e6d5c4-b3a2-4190-8081-7263544536f7",     "partner_id": "d4c3b2a1-0f9e-4d8c-7b6a-5948372615d4",     "old_status": "contacted",     "new_status": "booked",     "timestamp": "2026-04-24T14:30:00Z",     "conversion_value": null,     "currency": "USD",     "idempotency_token": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"   },   "signature": "5a8d3f2e1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e" }

Field	Type	Description
webhook_id	UUID v4	Unique identifier for this delivery attempt
webhook_type	String	Event type being delivered
delivery_attempt	Integer	Current attempt number (1-indexed)
max_retries	Integer	Maximum retry attempts (default: 3)
signature	String	HMAC-SHA256 hex digest of the payload using WEBHOOK_SIGNING_SECRET

4.5 Edge Function Trigger Schema (Supabase)
The Supabase database trigger fires on INSERT to lead_status_events and invokes the edge function with this payload.
{   "type": "INSERT",   "table": "lead_status_events",   "record": {     "id": "e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b",     "lead_id": "f7e6d5c4-b3a2-4190-8081-7263544536f7",     "partner_id": "d4c3b2a1-0f9e-4d8c-7b6a-5948372615d4",     "old_status": "contacted",     "new_status": "sold_won",     "conversion_value": 12500.00,     "currency": "USD",     "idempotency_token": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",     "created_at": "2026-04-24T14:30:00Z",     "created_by": "d4c3b2a1-0f9e-4d8c-7b6a-5948372615d4"   },   "old_record": null }

Edge Function Routing Logic
When new_status equals sold_won, the edge function fans out to two downstream handlers: (1) Meta Conversions API and (2) Google Ads Offline Conversions. For all other status changes, the edge function writes to activity_log only. All paths write to lead_status_events.


5. Minimal Data Model
All tables reside in the public schema of a Supabase (PostgreSQL) database. Primary keys are UUID v4 generated via gen_random_uuid(). All timestamps are TIMESTAMPTZ defaulting to now().
5.1 Entity: leads

Field	Type	Constraints	Notes
id	UUID	PK, DEFAULT gen_random_uuid()	
first_name	VARCHAR(100)	NOT NULL	Homeowner first name
last_name	VARCHAR(100)	NOT NULL	Homeowner last name
email	VARCHAR(255)	NOT NULL	
phone	VARCHAR(20)	NOT NULL	E.164 format (e.g., +15551234567)
street	VARCHAR(255)	NOT NULL	
city	VARCHAR(100)	NOT NULL	
state	VARCHAR(2)	NOT NULL	US state code (e.g., FL)
zip	VARCHAR(10)	NOT NULL	5-digit or ZIP+4
status	lead_status_enum	NOT NULL, DEFAULT 'new'	
notes	TEXT		Multi-line free text
assigned_partner_id	UUID	FK → partners.id	Nullable during redistribution
assigned_company_id	UUID	FK → companies.id, NOT NULL	Lead owned by company, not partner
source	VARCHAR(50)		e.g., 'meta_ad', 'google_ad', 'referral'
conversion_value	NUMERIC(12,2)		Set when status = sold_won
created_at	TIMESTAMPTZ	NOT NULL, DEFAULT now()	Immutable after creation
updated_at	TIMESTAMPTZ	NOT NULL, DEFAULT now()	Auto-updated via trigger

5.2 Entity: partners

Field	Type	Constraints	Notes
id	UUID	PK, DEFAULT gen_random_uuid()	
user_id	UUID	FK → auth.users.id, UNIQUE	Supabase Auth user reference
company_id	UUID	FK → companies.id, NOT NULL	
role	role_enum	NOT NULL	partner, admin, windowman, auditor
first_name	VARCHAR(100)	NOT NULL	
last_name	VARCHAR(100)	NOT NULL	
email	VARCHAR(255)	NOT NULL, UNIQUE	
phone	VARCHAR(20)		Optional
is_active	BOOLEAN	DEFAULT true	Soft delete / deactivation
created_at	TIMESTAMPTZ	DEFAULT now()	

5.3 Entity: companies

Field	Type	Constraints	Notes
id	UUID	PK, DEFAULT gen_random_uuid()	
name	VARCHAR(255)	NOT NULL	Company display name
stripe_customer_id	VARCHAR(255)	UNIQUE	Stripe customer reference (cus_xxx)
sla_hours	INTEGER	DEFAULT 48	Hours before a lead is considered stale
is_active	BOOLEAN	DEFAULT true	
created_at	TIMESTAMPTZ	DEFAULT now()	

5.4 Entity: lead_status_events

Field	Type	Constraints	Notes
id	UUID	PK, DEFAULT gen_random_uuid()	
lead_id	UUID	FK → leads.id, NOT NULL	
partner_id	UUID	FK → partners.id, NOT NULL	Actor who changed the status
old_status	lead_status_enum		NULL for initial lead creation
new_status	lead_status_enum	NOT NULL	
conversion_value	NUMERIC(12,2)		Populated on sold_won
currency	VARCHAR(3)	DEFAULT 'USD'	ISO 4217
idempotency_token	UUID	UNIQUE, NOT NULL	Prevents duplicate event processing
metadata	JSONB		source, ip_address, changed_by_role
created_at	TIMESTAMPTZ	DEFAULT now()	

5.5 Entity: activity_log

Field	Type	Constraints	Notes
id	UUID	PK, DEFAULT gen_random_uuid()	
lead_id	UUID	FK → leads.id, NOT NULL	
actor_id	UUID	FK → partners.id	NULL for system-generated events
activity_type	activity_type_enum	NOT NULL	status_change, note_added, call_made, email_sent, sms_sent, reassigned, call_recorded, bot_call
details	JSONB		Flexible payload (old/new status, note text, call duration, etc.)
created_at	TIMESTAMPTZ	DEFAULT now()	

5.6 Entity: conversion_events

Field	Type	Constraints	Notes
id	UUID	PK, DEFAULT gen_random_uuid()	
lead_status_event_id	UUID	FK → lead_status_events.id	Source event that triggered the conversion
destination	VARCHAR(20)	NOT NULL	'meta' or 'google'
payload	JSONB	NOT NULL	Full request payload sent to the API
response_status	INTEGER		HTTP status code from the API
response_body	JSONB		Full response body from the API
delivery_attempts	INTEGER	DEFAULT 0	Number of attempts made
delivered_at	TIMESTAMPTZ		Set on successful delivery
last_attempt_at	TIMESTAMPTZ		
status	delivery_status_enum	DEFAULT 'pending'	pending, delivered, failed
created_at	TIMESTAMPTZ	DEFAULT now()	

5.7 Entity: call_records

Field	Type	Constraints	Notes
id	UUID	PK, DEFAULT gen_random_uuid()	
lead_id	UUID	FK → leads.id	
partner_id	UUID	FK → partners.id	Caller (partner or system for bot calls)
twilio_call_sid	VARCHAR(50)	UNIQUE	Twilio Call SID reference
direction	VARCHAR(10)		'inbound' or 'outbound'
duration_seconds	INTEGER		Total call duration
recording_url	TEXT		Encrypted storage URL (signed, time-limited)
recording_consent	BOOLEAN	DEFAULT false	True only if consent was acknowledged
transcription	TEXT		Full text transcription (Phase 3)
sentiment	VARCHAR(10)		positive, neutral, negative (Phase 3)
is_bot_call	BOOLEAN	DEFAULT false	True for AI voice bot calls
created_at	TIMESTAMPTZ	DEFAULT now()	

5.8 Entity: billing_events

Field	Type	Constraints	Notes
id	UUID	PK, DEFAULT gen_random_uuid()	
company_id	UUID	FK → companies.id	
stripe_invoice_id	VARCHAR(255)		Stripe invoice reference (in_xxx)
billing_period_start	DATE	NOT NULL	Monday of the billing week
billing_period_end	DATE	NOT NULL	Sunday of the billing week
sold_won_count	INTEGER	NOT NULL	Number of sold_won events in period
amount_cents	INTEGER	NOT NULL	Total invoice amount in cents (USD)
status	billing_status_enum	DEFAULT 'pending'	pending, paid, failed
created_at	TIMESTAMPTZ	DEFAULT now()	

5.9 Entity: redistribution_rules

Field	Type	Constraints	Notes
id	UUID	PK, DEFAULT gen_random_uuid()	
company_id	UUID	FK → companies.id	
trigger_status	lead_status_enum		Status that triggers the rule evaluation
sla_hours	INTEGER	NOT NULL	Hours of inactivity before redistribution
fallback_partner_id	UUID	FK → partners.id	Partner to receive redistributed leads
is_active	BOOLEAN	DEFAULT true	Enable/disable toggle
created_at	TIMESTAMPTZ	DEFAULT now()	

5.10 Enums

Enum Name	Values
lead_status_enum	new contacted appointment_set booked canceled no_show rescheduled follow_up sold_won lost
role_enum	partner admin windowman auditor
activity_type_enum	status_change note_added call_made email_sent sms_sent reassigned call_recorded bot_call
delivery_status_enum	pending delivered failed
billing_status_enum	pending paid failed

5.11 Relationships (Entity-Relationship Summary)

Parent Entity	Cardinality	Child Entity	Foreign Key
companies	1 : N	partners	partners.company_id → companies.id
companies	1 : N	leads	leads.assigned_company_id → companies.id
partners	1 : N	leads	leads.assigned_partner_id → partners.id
leads	1 : N	lead_status_events	lead_status_events.lead_id → leads.id
leads	1 : N	activity_log	activity_log.lead_id → leads.id
leads	1 : N	call_records	call_records.lead_id → leads.id
lead_status_events	1 : N	conversion_events	conversion_events.lead_status_event_id → lead_status_events.id
companies	1 : N	billing_events	billing_events.company_id → companies.id
companies	1 : N	redistribution_rules	redistribution_rules.company_id → companies.id


6. UI/UX Requirements & Wireframe Notes
6.1 Global Navigation
●	Persistent bottom tab bar with three tabs:
○	"Leads" — list icon — navigates to Leads List / Kanban page
○	"Detail" — document icon — navigates to Lead Dossier (shows last viewed lead, or empty state)
○	"Command" — dashboard icon — navigates to Command Center
●	Tab labels are always visible (no icon-only mode). Active tab highlighted with brand accent color (#2b5797).
●	Mobile-first: 375px minimum viewport width. All touch targets are minimum 44px × 44px.
●	No hamburger menus. All primary navigation lives in the bottom bar. Secondary actions use contextual menus or action sheets.
6.2 Leads List Page

Element	Specification
Default view	Kanban board with swim-lane columns per status, ordered by lifecycle sequence
View toggle	Kanban ↔ List view toggle in the top bar. Preference persisted in local storage.
Kanban card contents	Lead name (first + last), phone number, status badge (color-coded), time-in-status (e.g., "2d 6h"), quick-action icons (call, email, SMS)
Filter bar	Top of page. Status multi-select chips, date range picker (created_at), partner dropdown. Active filter count badge.
Bulk action toolbar	Appears when one or more leads are selected. Buttons: "Change Status", "Reassign", "Export". Shows "N selected" count.
Floating Action Button (FAB)	"Add Lead" button (bottom-right). Visible only to admin and windowman roles. Opens create lead form.
Empty state	Illustrated empty state with message: "No leads match your filters" or "No leads yet — they'll appear here when assigned."

6.3 Lead Dossier Page

Section	Specification
Header	Lead name (full), status badge (editable dropdown), conversion value (editable on sold_won). Back arrow to Leads List.
Contact section	Phone (click-to-call icon button), email (click-to-email icon button), SMS (click-to-SMS icon button). All actions have distinct icons and labels.
Address section	Full formatted address (street, city, state, zip). "Open in Maps" link to Google Maps or Apple Maps.
Notes section	Multi-line editable textarea with "Save" button. Auto-saves on blur. Last modified timestamp shown.
Activity Timeline	Reverse chronological. Grouped by date. Each entry: icon (per activity type), timestamp, actor name, detail text. Infinite scroll or "Load More" pagination.
Call Recordings (Phase 2)	List of recordings. Each row: date/time, duration, play button, consent badge. Inline audio player with play/pause/seek/volume.
Transcription (Phase 3)	Expandable/collapsible transcript text. Sentiment badge (color-coded: green=positive, gray=neutral, red=negative).

6.4 Command Center Page

Section	Specification
KPI cards (top row)	Five cards: Total Leads, Active Leads, Sold Won (this week), Lost (this week), Stale Leads. Each shows count and week-over-week change indicator.
Stale Leads table	Leads with no activity beyond SLA hours. Columns: Lead Name, Status, Assigned Partner, Time Since Last Activity, "Reassign" button. Sortable by time since last activity.
Lost Leads table	Recently lost leads (last 30 days). Columns: Lead Name, Lost Date, Previous Status, Assigned Partner. Optional "Reactivate" action (transitions to follow_up).
Redistribution Rules panel	List of configurable rules. Each: trigger status, SLA hours, fallback partner, enable/disable toggle. "Add Rule" button. Inline editing.
Partner Performance (Phase 3)	Table: Partner Name, Total Leads, Sold Won, Conversion Rate (%), Avg. Time-to-Close (days), Lead Volume (this week). Sortable columns.


7. Security, Compliance & Operational Notes
7.1 RBAC Permission Matrix

Action	Partner	Admin	WindowMan	Auditor
View own company leads	Yes	Yes	Yes	Yes
View all leads (cross-company)	No	No	Yes	Yes
Edit own leads	Yes	Yes	Yes	No
Edit all leads	No	Yes	Yes	No
Reassign leads	No	Yes	Yes	No
Bulk actions	No	Yes	Yes	No
View billing	Own company	Own company	All	All
Manage billing	No	No	Yes	No
Manage users	No	Own company	All	No
View audit logs	No	No	Yes	Yes
Manage redistribution rules	No	Yes	Yes	No
Configure integrations	No	No	Yes	No


RLS Enforcement
All RBAC rules are enforced at the database level via Supabase Row-Level Security policies — not just at the API/middleware layer. This ensures that even direct database access (e.g., via Supabase client libraries) respects role boundaries. Every RLS policy references the authenticated user's JWT claims (auth.uid() and custom claims for role and company_id).

7.2 Recording Consent
●	All call recordings require explicit consent before recording begins.
●	Consent prompt played at the start of every call: "This call may be recorded for quality assurance. If you do not wish to be recorded, please let us know."
●	Consent flag is stored on call_records.recording_consent (BOOLEAN). Only calls where recording_consent = true are recorded and stored.
●	Non-consented calls: Recording is not initiated. The call proceeds without recording. The call_records entry is created with recording_consent = false and recording_url = NULL.
●	Phase 3 — Region-based rules:
○	One-party consent states: consent prompt is informational (recording proceeds unless opt-out).
○	Two-party consent states (e.g., CA, FL, IL, MD, MA, MT, NH, PA, WA): recording only proceeds after affirmative acknowledgment.
○	Region is determined by the lead's state field.
7.3 Data Retention

Data Type	Retention Period	Action on Expiry
Lead records	7 years (configurable per company)	Soft delete → hard delete after 90-day grace period
Call recordings	2 years	Auto-deleted from storage; recording_url set to NULL
Transcriptions	2 years	Cleared from call_records.transcription
Audit logs / activity_log	Indefinite	Never deleted
Billing records	7 years	Archived to cold storage
Conversion events	7 years	Archived to cold storage

7.4 Security Controls

Control	Implementation
Authentication	All API calls authenticated via Supabase JWT (access token). Magic link + email/password auth supported.
Authorization	Row-Level Security (RLS) on all tables. Role and company_id validated per request.
Encryption at rest	AES-256 encryption for all PII fields. Call recordings encrypted in storage bucket.
Encryption in transit	TLS 1.2+ enforced on all connections. HSTS headers enabled.
API rate limiting	100 requests per minute per authenticated user. 429 Too Many Requests returned on exceeded.
Webhook security	Webhook payloads signed via HMAC-SHA256 using WEBHOOK_SIGNING_SECRET. Signature included in X-Signature-256 header. Receivers must verify before processing.
Input validation	All inputs validated server-side. SQL injection prevention via parameterized queries (Supabase). XSS prevention via output encoding.
Audit trail	All create, update, delete operations logged with actor, timestamp, old/new values.


8. Sprint Plan (6 × 2-Week Sprints)
Total timeline: 12 weeks. Each sprint is two weeks. Sprints 1–3 deliver the MVP (P0). Sprints 4–5 deliver Phase 2 (P1). Sprint 6 delivers Phase 3 (P2) foundations and system polish.
Sprint 1: Foundation & Navigation (Weeks 1–2)
Goal: Establish the application shell, authentication, RBAC, and core data model. Deliver a functional Leads List page with basic list view.
Tasks
59.	Set up Supabase project; configure auth providers (email + magic link).
60.	Create database schema: leads, partners, companies tables with all enums (lead_status_enum, role_enum, activity_type_enum).
61.	Implement RLS policies for all four roles on leads, partners, and companies tables.
62.	Build three-page navigation shell with persistent bottom tab bar (Leads, Detail, Command).
63.	Create lead CRUD API endpoints: POST /leads, GET /leads, GET /leads/:id, PATCH /leads/:id.
64.	Build Leads List page with basic list view (table/card layout, no Kanban yet).
65.	Seed test data for all four roles (partner, admin, windowman, auditor) with sample leads.
Sprint Notes

Team	Action Items
Design	Finalize mobile-first wireframes for all three pages. Define color system (primary: #2b5797), typography scale, and spacing grid. Deliver bottom tab bar component spec.
Product	Validate lead status enum with stakeholders. Confirm required vs. optional field list. Sign off on role definitions and permission matrix.
Engineering	Scaffold Supabase Edge Functions project. Set up CI/CD pipeline (GitHub Actions → Supabase deploy). Configure development, staging, and production environments.

Sprint 2: Kanban, Lead Dossier & Quick Actions (Weeks 3–4)
Goal: Deliver the Kanban board with drag-and-drop, full Lead Dossier page with quick actions, and the Activity Timeline component.
Tasks
66.	Build Kanban board component with drag-and-drop (columns mapped to status enum values).
67.	Implement optimistic updates with rollback on API failure for Kanban drag-and-drop.
68.	Build Lead Dossier page with all sections: header, contact, address, notes.
69.	Implement click-to-call (tel: link), click-to-email (mailto:), click-to-SMS (sms:) quick actions.
70.	Build Activity Timeline component on Lead Dossier (reverse chronological, grouped by date).
71.	Implement lead status change API with transition validation (enforce valid transitions per matrix).
72.	Add Kanban ↔ List view toggle with preference persistence.
Sprint Notes

Team	Action Items
Design	Deliver Kanban card design (name, phone, status badge, time-in-status). Lead Dossier layout with section hierarchy. Activity timeline component spec with icons per activity type.
Product	Define activity types for timeline display. Confirm quick action behaviors per platform (mobile vs. desktop). Approve status transition matrix.
Engineering	Evaluate drag-and-drop libraries (dnd-kit recommended for React). Implement status transition validation as a reusable function. Write integration tests for status change API.

Sprint 3: Edge Functions, Conversion Events & Filters (Weeks 5–6)
Goal: Wire up the event system — edge functions fire on every status change, conversion events flow to Meta and Google on sold_won, and filters are functional on the Leads List.
Tasks
73.	Create lead_status_events table and database trigger (fires on INSERT).
74.	Implement Supabase edge function: on INSERT to lead_status_events, produce structured event payload with idempotency token.
75.	Create conversion_events table and delivery pipeline.
76.	Implement Meta Conversions API integration: SHA-256 hashed PII, correct event schema (Section 4.2).
77.	Implement Google Ads Offline Conversion API integration (Section 4.3).
78.	Add retry logic with exponential backoff (1s → 4s → 16s, max 3 retries) for failed conversion deliveries.
79.	Build filter bar on Leads List: status multi-select chips, date range picker, partner dropdown.
80.	Implement filter API with composable AND logic and active filter indicators.
Sprint Notes

Team	Action Items
Design	Filter chip UI with selection states. Active filter count badge. Date range picker mobile UX.
Product	Confirm Meta Pixel ID and access token. Confirm Google Ads customer ID and conversion action ID. Provide test event codes for both platforms.
Engineering	Set up Meta Conversions API test events (use test event code). Set up Google Ads test conversions in sandbox. Implement HMAC-SHA256 webhook signatures. Load test edge function for p95 < 500ms.

Sprint 4: Bulk Actions, Command Center & Redistribution (Weeks 7–8)
Goal: Enable bulk operations on the Leads List, build the Command Center dashboard with KPI cards and stale lead management, and implement lead redistribution rules.
Tasks
81.	Implement multi-select on Leads List (checkboxes on each card/row, "Select All" for visible leads).
82.	Build bulk status change API (validates each transition individually, fires edge function events per lead).
83.	Build bulk reassign API (updates assigned_partner_id, logs reassigned activity per lead).
84.	Create Command Center page with KPI cards: Total Leads, Active Leads, Sold Won (this week), Lost (this week), Stale Leads.
85.	Build stale leads query: leads with no entry in activity_log within companies.sla_hours.
86.	Create redistribution_rules table and configuration UI (CRUD with enable/disable toggle).
87.	Implement one-click reassign from stale leads table (assigns to fallback_partner_id).
88.	Build lost leads table on Command Center (last 30 days, with optional "Reactivate" action).
Sprint Notes

Team	Action Items
Design	Command Center dashboard layout with KPI card designs. Stale leads table UX with reassign button. Redistribution rules panel with inline editing.
Product	Define default SLA hours (48h). Define redistribution business rules. Confirm stale lead definition (no activity vs. no status change). Sign off on KPI card metrics.
Engineering	Optimize stale leads query — consider a materialized view or a scheduled function that pre-computes stale lead lists every 15 minutes. Index activity_log(lead_id, created_at).

Sprint 5: Stripe Billing & Twilio Integration (Weeks 9–10)
Goal: Implement weekly billing via Stripe and telephony features via Twilio (DNI, call recording with consent, in-app playback).
Tasks
89.	Set up Stripe customer records for each company (sync companies.stripe_customer_id).
90.	Build weekly billing cron job: runs Monday 00:00 UTC, counts sold_won events per company in the prior week, creates Stripe invoice.
91.	Create billing_events table and billing history API.
92.	Build billing history UI (visible to partner, admin, windowman, auditor per RBAC matrix).
93.	Implement Twilio DNI: assign tracking numbers from TWILIO_PHONE_NUMBER_POOL, replace displayed numbers.
94.	Implement call recording with consent prompt flow (TwiML-based).
95.	Create call_records table; store recordings in encrypted cloud storage.
96.	Build in-app audio playback component (play, pause, seek, volume, duration display).
97.	Link call records to activity timeline (call_made and call_recorded activity types).
Sprint Notes

Team	Action Items
Design	Billing history table design. In-app audio player component spec. Consent prompt UX flow (what happens on opt-out).
Product	Confirm per-lead price for billing. Confirm billing cycle (Monday 00:00 UTC). Provision Twilio phone number pool. Approve consent prompt wording.
Engineering	Set up Stripe test mode with test clock for billing cycle testing. Set up Twilio sandbox for DNI and recording. Implement recording consent flow via TwiML <Say> + <Gather>. Configure encrypted storage bucket.

Sprint 6: Transcription, Sentiment, AI Bot & Polish (Weeks 11–12)
Goal: Add call transcription, sentiment analysis, AI outbound voice bot, region-based compliance, data retention policies, and perform full system QA and optimization.
Tasks
98.	Integrate speech-to-text service (Deepgram or AssemblyAI) for call transcriptions.
99.	Build transcription display on Lead Dossier (expandable/collapsible text block).
100.	Implement sentiment analysis pipeline: classify each transcription as positive, neutral, or negative.
101.	Build AI outbound voice bot with configurable call scripts (stored in database, editable by windowman role).
102.	Implement bot call recording, transcription, and activity timeline logging (bot_call type).
103.	Add region-based recording consent checks (two-party consent state list, determined by lead state field).
104.	Implement data retention policies: automated purge schedules via scheduled Supabase functions.
105.	End-to-end QA: full regression across all features, all roles, all pages.
106.	Performance optimization: query profiling, edge function latency, load testing (target: 100 concurrent users).
Sprint Notes

Team	Action Items
Design	Transcription UI (expandable text block). Sentiment badge design (green/gray/red). Bot call initiation UX (confirmation dialog before dialing).
Product	Define initial bot call scripts (greeting, qualification questions, closing). Confirm STT provider selection. Finalize data retention policy durations. Sign off on two-party consent state list.
Engineering	Evaluate STT providers: Deepgram (faster, streaming) vs. AssemblyAI (better accuracy, built-in sentiment). Implement sentiment model or use provider's built-in. Load test edge functions at 100 RPS. Set up automated purge cron jobs.


9. Appendix
9.1 Status Transition Matrix
The following table defines all valid status transitions. Any transition not listed is invalid and must be rejected by the API with a 422 Unprocessable Entity response.

From Status	Valid Transitions To
new	contacted, lost
contacted	appointment_set, follow_up, lost
appointment_set	booked, canceled, lost
booked	sold_won, canceled, no_show, rescheduled, lost
canceled	follow_up, lost
no_show	follow_up, rescheduled, lost
rescheduled	booked, canceled, lost
follow_up	contacted, appointment_set, lost
sold_won	(terminal — no transitions allowed)
lost	follow_up (reactivation only)


Note: Transition Validation
The transition matrix is enforced server-side in the status change API endpoint and in the edge function trigger. Invalid transitions from the Kanban drag-and-drop are caught before the API call fires, with an inline error message displayed on the card. The transition matrix should be stored as a configuration object (not hard-coded logic) to allow future modifications without code changes.

9.2 Environment Variables Required
All environment variables must be set in the Supabase project settings (Edge Function secrets) and in the application's runtime environment. Sensitive values must never be committed to source control.

Category	Variable	Description
Supabase	SUPABASE_URL	Supabase project URL (https://xxx.supabase.co)
Supabase	SUPABASE_ANON_KEY	Supabase anonymous/public key (client-side)
Supabase	SUPABASE_SERVICE_ROLE_KEY	Supabase service role key (server-side only, bypasses RLS)
Meta	META_PIXEL_ID	Meta Pixel ID for conversion tracking
Meta	META_ACCESS_TOKEN	Meta Conversions API access token
Meta	META_TEST_EVENT_CODE	Test event code for sandbox testing (remove in production)
Google Ads	GOOGLE_ADS_CUSTOMER_ID	Google Ads customer ID (without hyphens)
Google Ads	GOOGLE_ADS_CONVERSION_ACTION_ID	Conversion action resource name
Google Ads	GOOGLE_ADS_DEVELOPER_TOKEN	Google Ads API developer token
Stripe	STRIPE_SECRET_KEY	Stripe secret API key
Stripe	STRIPE_WEBHOOK_SECRET	Stripe webhook endpoint signing secret
Stripe	STRIPE_PRICE_ID	Stripe Price ID for per-lead billing
Twilio	TWILIO_ACCOUNT_SID	Twilio account SID
Twilio	TWILIO_AUTH_TOKEN	Twilio auth token
Twilio	TWILIO_PHONE_NUMBER_POOL	Comma-separated list of Twilio phone numbers for DNI
STT	STT_API_KEY	Speech-to-text provider API key
STT	STT_PROVIDER	Provider identifier: deepgram or assemblyai
Storage	RECORDING_STORAGE_BUCKET	Cloud storage bucket name for call recordings
Storage	RECORDING_ENCRYPTION_KEY	AES-256 encryption key for recording files
Application	APP_BASE_URL	Application base URL (e.g., https://app.windowman.com)
Application	WEBHOOK_SIGNING_SECRET	HMAC-SHA256 secret for signing outbound webhooks

9.3 Glossary

Term	Definition
DNI	Dynamic Number Insertion. A technique where a unique tracking phone number is displayed to the user instead of the actual business number, enabling call attribution to a specific lead, partner, or ad campaign.
SLA	Service Level Agreement. In this context, the maximum number of hours a lead can remain without activity before being flagged as "stale" and eligible for redistribution.
RLS	Row-Level Security. A PostgreSQL feature that restricts which rows a user can access based on policies attached to the table. Supabase RLS policies reference the authenticated user's JWT claims.
RBAC	Role-Based Access Control. An authorization model where permissions are assigned to roles, and users are assigned roles. This system uses four roles: partner, admin, windowman, auditor.
STT	Speech-to-Text. The process of converting spoken audio into written text. Used for call transcription in Phase 3.
PII	Personally Identifiable Information. Data that can identify an individual, such as name, email, phone, and address. Must be hashed (SHA-256) before sending to third-party APIs like Meta.
Idempotency Token	A unique identifier (UUID v4) attached to each event that ensures the operation is processed exactly once. If the same token is submitted again (e.g., on retry), the system returns success without re-processing.
Edge Function	A serverless function deployed on Supabase Edge (Deno-based) that executes in response to database triggers or HTTP requests. Used for event processing and conversion API calls.
Kanban	A visual project management method using columns and cards. In this system, columns represent lead statuses and cards represent individual leads. Drag-and-drop moves a card between columns, triggering a status change.
Lead Dossier	A comprehensive detail page for a single lead, showing all contact information, activity history, call recordings, notes, and quick actions.
Conversion Event	A signal sent to an advertising platform (Meta or Google) indicating that a lead has completed a desired action (purchase/sold_won). Used for ad optimization and attribution.
DNI Pool	A set of Twilio phone numbers assigned to a company for Dynamic Number Insertion. Numbers are allocated per-lead to enable call tracking and attribution.


WindowMan Partner Mini-CRM & Lead Management System — Product Specification v1.0
 April 24, 2026 — Internal Confidential
 End of Document
