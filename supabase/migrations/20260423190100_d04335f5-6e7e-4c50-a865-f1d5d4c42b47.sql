-- ─────────────────────────────────────────────────────────────────────
-- Sprint 5: Lead notes + tasks for the admin CRM workflow
-- ─────────────────────────────────────────────────────────────────────

-- ── lead_notes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  body         text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  category     text NULL CHECK (category IS NULL OR category IN ('general','call','email','sms','meeting','internal')),
  created_by   uuid NULL,
  created_by_email text NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id_created_at
  ON public.lead_notes (lead_id, created_at DESC);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_operators_select_lead_notes"
  ON public.lead_notes FOR SELECT TO authenticated
  USING (public.is_internal_operator());

CREATE POLICY "internal_operators_insert_lead_notes"
  ON public.lead_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_operator());

CREATE POLICY "internal_operators_update_lead_notes"
  ON public.lead_notes FOR UPDATE TO authenticated
  USING (public.is_internal_operator())
  WITH CHECK (public.is_internal_operator());

CREATE POLICY "internal_operators_delete_lead_notes"
  ON public.lead_notes FOR DELETE TO authenticated
  USING (public.is_internal_operator());

CREATE TRIGGER trg_lead_notes_set_updated_at
  BEFORE UPDATE ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── lead_tasks ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  details       text NULL CHECK (details IS NULL OR char_length(details) <= 4000),
  due_at        timestamptz NULL,
  completed     boolean NOT NULL DEFAULT false,
  completed_at  timestamptz NULL,
  completed_by  uuid NULL,
  assigned_to   uuid NULL,
  created_by    uuid NULL,
  created_by_email text NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead_id_created_at
  ON public.lead_tasks (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_open_due_at
  ON public.lead_tasks (due_at) WHERE completed = false;

ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_operators_select_lead_tasks"
  ON public.lead_tasks FOR SELECT TO authenticated
  USING (public.is_internal_operator());

CREATE POLICY "internal_operators_insert_lead_tasks"
  ON public.lead_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_operator());

CREATE POLICY "internal_operators_update_lead_tasks"
  ON public.lead_tasks FOR UPDATE TO authenticated
  USING (public.is_internal_operator())
  WITH CHECK (public.is_internal_operator());

CREATE POLICY "internal_operators_delete_lead_tasks"
  ON public.lead_tasks FOR DELETE TO authenticated
  USING (public.is_internal_operator());

CREATE TRIGGER trg_lead_tasks_set_updated_at
  BEFORE UPDATE ON public.lead_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();