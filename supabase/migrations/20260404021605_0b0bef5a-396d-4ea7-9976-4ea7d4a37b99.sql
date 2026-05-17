
-- Step 3: webhook_deliveries table
CREATE TABLE public.webhook_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL,
  event_type      text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  payload_json    jsonb,
  webhook_url     text,

  attempt_count   integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 5,
  last_attempt_at timestamptz,
  next_retry_at   timestamptz,
  last_http_status integer,
  last_error      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_deliveries_select_internal ON public.webhook_deliveries
  FOR SELECT TO authenticated USING (public.is_internal_operator());
CREATE POLICY webhook_deliveries_insert_internal ON public.webhook_deliveries
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_operator());
CREATE POLICY webhook_deliveries_update_internal ON public.webhook_deliveries
  FOR UPDATE TO authenticated
  USING (public.is_internal_operator())
  WITH CHECK (public.is_internal_operator());
CREATE POLICY webhook_deliveries_delete_internal ON public.webhook_deliveries
  FOR DELETE TO authenticated USING (public.is_internal_operator());

-- Allow service_role (edge functions) to insert/update without auth
CREATE POLICY webhook_deliveries_service_role_all ON public.webhook_deliveries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-update updated_at (uses canonical helper from 20260318033552; set_updated_at() is defined later)
CREATE TRIGGER set_webhook_deliveries_updated_at
  BEFORE UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Step 4: Dual-gate trigger on leads
CREATE OR REPLACE FUNCTION public.fire_crm_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fire only when BOTH gates are satisfied for the first time
  IF NEW.phone_verified = true
     AND NEW.latest_analysis_id IS NOT NULL
     AND (OLD.phone_verified = false OR OLD.latest_analysis_id IS NULL)
  THEN
    INSERT INTO public.webhook_deliveries (lead_id, event_type, status)
    VALUES (NEW.id, 'qualified_lead', 'pending');

    RAISE LOG '[CRM:HANDOFF:QUEUED] {"lead_id": "%", "timestamp": "%"}',
      NEW.id, NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fire_crm_handoff
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.fire_crm_handoff();
