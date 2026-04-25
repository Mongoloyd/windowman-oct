---
name: Client Config Privacy and No Backfill
description: client_configs must start empty; never backfill or infer config from historical/test data; use neutral campaign-safe client naming.
type: feature
---
The canonical `client_configs` table must not be backfilled from historical data.

Never copy or infer rows from leads, clients, meta_configurations, capi_signal_logs, event_logs, webhook_deliveries, contractor_outcomes, or test/development records.

If legacy client/meta/signal data exists, show it only as a read-only warning/reference. Do not link it to real client_configs automatically.

Admins create the first real client manually through `/admin/partners`; do not create demo/sample/placeholder rows.

Client slugs and tracking payloads must use neutral, campaign-safe naming and must not expose personal names, payout terms, contractor relationships, internal lead resale logic, or test garbage identifiers.
