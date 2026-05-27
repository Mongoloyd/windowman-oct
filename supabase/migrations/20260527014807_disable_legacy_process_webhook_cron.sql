-- Disable legacy process-webhooks cron job from the old Lovable/main Supabase project.
--
-- Historical migration:
-- supabase/migrations/20260404105923_eab75b78-c0ea-4a08-a255-a142bc302c2f.sql
--
-- Legacy job:
-- process-webhooks-every-minute
--
-- Legacy target:
-- https://wkrcyxcnzhwjtdpmfpaf.supabase.co/functions/v1/process-webhook
--
-- This endpoint belongs to the old Lovable/main project and must not run from
-- forensic_report_v2 local, staging, or the new Netlify/Supabase split.
--
-- Future outbound lead processing / phonecall.bot automation should be rebuilt
-- as a V2-native scheduled job using project-local endpoints, project-scoped
-- secrets, and an explicit kill switch.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'process-webhooks-every-minute';
  end if;
exception
  when undefined_table or undefined_function or invalid_schema_name then
    raise notice 'pg_cron not available or legacy job missing; skipping unschedule';
end $$;
