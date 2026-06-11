-- Admin lead disposition / follow-up tracking columns
-- Strictly additive. Safe to run multiple times.
-- Powers the /admin/leads operator disposition workflow via admin-data.
-- No RLS, policy, trigger, index, or backfill changes in this migration.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS admin_disposition text,
  ADD COLUMN IF NOT EXISTS admin_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_priority_override text,
  ADD COLUMN IF NOT EXISTS admin_disposition_updated_at timestamptz;

COMMENT ON COLUMN public.leads.admin_disposition IS
  'Operator-set follow-up disposition for the lead desk. Allowed values are enforced in admin-data (new, needs_contact, contacted, follow_up, not_qualified, closed).';

COMMENT ON COLUMN public.leads.admin_follow_up_at IS
  'Optional operator-scheduled follow-up timestamp for the lead.';

COMMENT ON COLUMN public.leads.admin_last_contacted_at IS
  'Timestamp of the most recent operator contact attempt recorded from the lead desk.';

COMMENT ON COLUMN public.leads.admin_priority_override IS
  'Optional manual priority override for the lead desk. Allowed values are enforced in admin-data (hot, warm, cold, none).';

COMMENT ON COLUMN public.leads.admin_disposition_updated_at IS
  'Server-set timestamp of the last admin disposition update; written by admin-data, never trusted from the client.';
