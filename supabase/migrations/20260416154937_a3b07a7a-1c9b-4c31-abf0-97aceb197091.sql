
-- ═══════════════════════════════════════════════════════════════════
-- PHASE 1 PREFLIGHT: RLS HARDENING
-- Tables with RLS enabled but zero policies
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. analyses ──────────────────────────────────────────────────
-- Access model: SECURITY DEFINER RPCs (get_analysis_preview, get_analysis_full)
-- Writes: scan-quote edge function (service-role)
-- Frontend: NEVER reads directly

CREATE POLICY "analyses_service_role_all"
  ON public.analyses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "analyses_select_internal"
  ON public.analyses FOR SELECT
  TO authenticated
  USING (public.is_internal_operator());

-- ─── 2. contractor_opportunities ──────────────────────────────────
-- Access model: admin dashboard (internal operator), edge functions (service-role)
-- Frontend reads from ReportClassic/PostScanReportSwitcher return empty (by design)

CREATE POLICY "contractor_opportunities_service_role_all"
  ON public.contractor_opportunities FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "contractor_opportunities_select_internal"
  ON public.contractor_opportunities FOR SELECT
  TO authenticated
  USING (public.is_internal_operator());

CREATE POLICY "contractor_opportunities_insert_internal"
  ON public.contractor_opportunities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_operator());

CREATE POLICY "contractor_opportunities_update_internal"
  ON public.contractor_opportunities FOR UPDATE
  TO authenticated
  USING (public.is_internal_operator())
  WITH CHECK (public.is_internal_operator());

CREATE POLICY "contractor_opportunities_delete_internal"
  ON public.contractor_opportunities FOR DELETE
  TO authenticated
  USING (public.is_internal_operator());

-- ─── 3. county_benchmarks ─────────────────────────────────────────
-- Access model: refresh-benchmarks edge function writes (service-role)
-- Frontend uses hardcoded countyData.ts, not this table
-- Allow public SELECT for future benchmark display
-- Guarded because clean staging may not include this optional/future table.

DO $$
BEGIN
  IF to_regclass('public.county_benchmarks') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "county_benchmarks_service_role_all" ON public.county_benchmarks';
    EXECUTE 'DROP POLICY IF EXISTS "county_benchmarks_select_public" ON public.county_benchmarks';

    EXECUTE $policy$
      CREATE POLICY "county_benchmarks_service_role_all"
        ON public.county_benchmarks FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "county_benchmarks_select_public"
        ON public.county_benchmarks FOR SELECT
        TO anon, authenticated
        USING (true)
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping county_benchmarks policies: public.county_benchmarks does not exist.';
  END IF;
END $$;

-- ─── 4. lead_events ──────────────────────────────────────────────
-- Access model: triggers + edge functions write (service-role)
-- Admin dashboard reads via edge functions, but add internal SELECT for direct queries

CREATE POLICY "lead_events_service_role_all"
  ON public.lead_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "lead_events_select_internal"
  ON public.lead_events FOR SELECT
  TO authenticated
  USING (public.is_internal_operator());

-- ─── 5. phone_verifications ──────────────────────────────────────
-- Access model: SECURITY DEFINER RPCs + edge functions (service-role)
-- Frontend NEVER reads directly

CREATE POLICY "phone_verifications_service_role_all"
  ON public.phone_verifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 6. quote_analyses (legacy) ──────────────────────────────────
-- Legacy table from early prototype. Not used by current product.

CREATE POLICY "quote_analyses_service_role_all"
  ON public.quote_analyses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 7. quote_comparisons ────────────────────────────────────────
-- Access model: compare-quotes edge function (service-role)
-- Guarded because clean staging may not include this optional/legacy table.

DO $$
BEGIN
  IF to_regclass('public.quote_comparisons') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "quote_comparisons_service_role_all" ON public.quote_comparisons';
    EXECUTE 'DROP POLICY IF EXISTS "quote_comparisons_select_internal" ON public.quote_comparisons';

    EXECUTE $policy$
      CREATE POLICY "quote_comparisons_service_role_all"
        ON public.quote_comparisons FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "quote_comparisons_select_internal"
        ON public.quote_comparisons FOR SELECT
        TO authenticated
        USING (public.is_internal_operator())
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping quote_comparisons policies: public.quote_comparisons does not exist.';
  END IF;
END $$;

-- ─── 8. service_tickets (legacy/unrelated) ───────────────────────
-- Not part of core product. Legacy or test table.
-- Guarded because clean staging may not include this legacy/unrelated table.

DO $$
BEGIN
  IF to_regclass('public.service_tickets') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "service_tickets_service_role_all" ON public.service_tickets';

    EXECUTE $policy$
      CREATE POLICY "service_tickets_service_role_all"
        ON public.service_tickets FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  ELSE
    RAISE NOTICE 'Skipping service_tickets policies: public.service_tickets does not exist.';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- FIX: Function search_path warnings
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_contractor_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_contractor_pipeline_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
begin
  if new.pipeline_stage is distinct from old.pipeline_stage then
    insert into public.contractor_activity_log (
      contractor_lead_id,
      activity_type,
      activity_data
    )
    values (
      new.id,
      'stage_changed',
      jsonb_build_object(
        'from', old.pipeline_stage,
        'to', new.pipeline_stage
      )
    );
  end if;

  return new;
end;
$function$;
