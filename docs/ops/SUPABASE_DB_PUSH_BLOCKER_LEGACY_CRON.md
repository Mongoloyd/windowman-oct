# Supabase DB Push Blocker — Legacy Cron Webhook

## Status

Do not run:

- npx supabase db push
- npx supabase db reset
- npx supabase start

until this blocker is resolved.

## Blocker

Historical migration:

supabase/migrations/20260404105923_eab75b78-c0ea-4a08-a255-a142bc302c2f.sql

contains a pg_cron scheduled job:

process-webhooks-every-minute

that calls:

https://wkrcyxcnzhwjtdpmfpaf.supabase.co/functions/v1/process-webhook

This is the old Lovable/main Supabase project.

## Risk

If replayed locally or pushed to the forensic V2 project, this migration may create a database-level outbound HTTP job that calls old-main infrastructure. Frontend .env safety does not protect against this because pg_cron/net.http_post execute inside Postgres.

## Required decision

Before any DB push/reset/start, decide whether:

1. zgsofkgddpcntdvpckdq is the source of truth and old migrations should not be blindly replayed, or
2. repo migrations are source of truth and a new corrective migration must unschedule/replace this legacy webhook job.

Recommended default: treat zgsofkgddpcntdvpckdq as source of truth and do not blindly replay contaminated legacy migrations.
