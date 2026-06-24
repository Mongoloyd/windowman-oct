# Notification Outbox — Sprint 2 Design (Deferred)

**Status:** Design only. No schema, no sender, no deploy in Sprint 1.

## Purpose

When WindowMan is ready to send homeowner/operator email or SMS after CRM capture events, the notification layer must not require redesigning the Sprint 1 lead spine.

Sprint 1 stores:

- Canonical timeline rows in `public.lead_events`
- Denormalized inbox snapshot on `public.leads` (`last_activity_at`, `latest_activity_type`)
- Follow-up readiness in `lead_events.metadata.followup_readiness`

Sprint 2 adds an **outbox** that references those rows without duplicating PII-heavy payloads.

## Proposed table: `notification_outbox`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `lead_id` | uuid FK → leads | Required |
| `lead_event_id` | uuid FK → lead_events | Optional link to triggering activity |
| `channel` | text | `email` \| `sms` \| `webhook` |
| `template_key` | text | e.g. `quote_uploaded_follow_up` |
| `status` | text | `pending` \| `scheduled` \| `sent` \| `failed` \| `skipped` |
| `payload_json` | jsonb | Hydrated template context — **no secrets, no full_json, no quote file bytes** |
| `scheduled_for` | timestamptz | Nullable |
| `sent_at` | timestamptz | Nullable |
| `error` | text | Nullable last error |
| `created_at` | timestamptz | |

## Enqueue rules (future)

- Enqueue only when `lead_events.metadata.followup_readiness = 'follow_up_ready'` unless an operator manually triggers a send.
- `high_intent_contact_missing` may enqueue an internal operator alert, not an automated homeowner SMS.
- Never auto-send when contact fields are missing for external channels.

## Sender boundary

- Actual Twilio/Resend (or similar) sends happen in a **future Edge Function** or worker, not in capture writers.
- Capture Edge Functions (`capture-truth-gate-lead`, `start-upload-scan-session`, etc.) must **not** call external senders.

## Relationship to existing queues

| Mechanism | Role |
|-----------|------|
| `voice_followups` | Voice call queue (existing) |
| `webhook_deliveries` | Contractor CRM handoff (existing) |
| `notification_outbox` | Homeowner/operator email/SMS (Sprint 2+) |

## Human steps before implementation

1. Apply Sprint 1 migration (`20260624120000_crm_lead_activity_spine.sql`)
2. Regenerate `src/integrations/supabase/types.ts`
3. Deploy updated capture Edge Functions
4. Open dedicated Sprint 2 with migration approval for `notification_outbox`
