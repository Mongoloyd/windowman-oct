-- ═══════════════════════════════════════════════════════════════════════════
-- DIRECT CLIENT FALLBACK + STUCK OPPORTUNITY RECOVERY
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Activate the direct tenant.
UPDATE public.clients
SET is_active = true
WHERE slug = 'direct' AND is_active = false;

-- 2. Seed default assignment for `direct` → canonical active contractor.
DO $$
DECLARE
  v_direct_client_id uuid;
  v_canonical_contractor_id uuid;
  v_canonical_email text;
BEGIN
  SELECT id INTO v_direct_client_id
  FROM public.clients WHERE slug = 'direct' LIMIT 1;

  SELECT id, email INTO v_canonical_contractor_id, v_canonical_email
  FROM public.contractors
  WHERE status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_direct_client_id IS NULL OR v_canonical_contractor_id IS NULL THEN
    RAISE NOTICE 'Skip seed assignment: direct=% canonical=%',
      v_direct_client_id, v_canonical_contractor_id;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contractor_client_assignments
    WHERE client_id = v_direct_client_id
      AND contractor_id = v_canonical_contractor_id
  ) THEN
    INSERT INTO public.contractor_client_assignments (
      client_id, contractor_id,
      is_primary, priority,
      receives_leads, status,
      dispatch_method,
      crm_webhook_url, crm_email,
      notes
    ) VALUES (
      v_direct_client_id, v_canonical_contractor_id,
      true, 1,
      true, 'active',
      CASE WHEN v_canonical_email IS NOT NULL THEN 'email' ELSE 'manual' END,
      NULL,
      v_canonical_email,
      'Seeded fallback assignment for direct/organic leads (single-client default).'
    );
  END IF;
END $$;

-- 3. Backfill NULL client_slug → 'direct' on leads.
UPDATE public.leads
SET client_slug = 'direct'
WHERE client_slug IS NULL;

-- 4. Re-enqueue verified+analyzed leads that have no live delivery row.
DO $$
DECLARE
  v_lead RECORD;
  v_route RECORD;
  v_status text;
  v_destination jsonb;
  v_payload jsonb;
  v_inserted_id uuid;
  v_count int := 0;
BEGIN
  FOR v_lead IN
    SELECT l.id, l.client_slug, l.latest_analysis_id, l.phone_verified_at
    FROM public.leads l
    WHERE l.phone_verified = true
      AND l.latest_analysis_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.webhook_deliveries wd
        WHERE wd.lead_id = l.id
          AND wd.event_type = 'qualified_lead'
          AND wd.status NOT IN ('delivered','mock_delivered','dead_letter')
      )
  LOOP
    SELECT * INTO v_route FROM public.resolve_route_for_lead(v_lead.id) LIMIT 1;

    IF v_route.resolved THEN
      v_status := 'pending';
      v_destination := jsonb_build_object(
        'dispatch_method', v_route.dispatch_method,
        'webhook_url',     v_route.crm_webhook_url,
        'email',           v_route.crm_email,
        'company_name',    v_route.company_name
      );
    ELSE
      v_status := 'unroutable';
      v_destination := NULL;
    END IF;

    v_payload := jsonb_build_object(
      'lead_id',           v_lead.id,
      'client_slug',       v_lead.client_slug,
      'analysis_id',       v_lead.latest_analysis_id,
      'phone_verified_at', v_lead.phone_verified_at,
      'enqueued_at',       now(),
      'enqueued_via',      'sprint6_backfill'
    );

    INSERT INTO public.webhook_deliveries (
      lead_id, event_type, status,
      payload_json, webhook_url,
      client_slug, contractor_id, assignment_id,
      dispatch_method, destination_snapshot, no_route_reason,
      resolved_at, terminal_at
    ) VALUES (
      v_lead.id, 'qualified_lead', v_status,
      v_payload, v_route.crm_webhook_url,
      v_lead.client_slug, v_route.contractor_id, v_route.assignment_id,
      v_route.dispatch_method, v_destination, v_route.no_route_reason,
      CASE WHEN v_route.resolved THEN now() ELSE NULL END,
      CASE WHEN v_status = 'unroutable' THEN now() ELSE NULL END
    )
    RETURNING id INTO v_inserted_id;

    v_count := v_count + 1;

    -- Use allowed event_name 'crm_handoff_queued' and store the unroutable
    -- distinction in metadata.no_route_reason / metadata.delivery_status.
    INSERT INTO public.lead_events (lead_id, event_name, event_source, metadata)
    VALUES (
      v_lead.id,
      'crm_handoff_queued',
      'system',
      jsonb_build_object(
        'analysis_id',         v_lead.latest_analysis_id,
        'phone_verified_at',   v_lead.phone_verified_at,
        'webhook_delivery_id', v_inserted_id,
        'client_slug',         v_lead.client_slug,
        'contractor_id',       v_route.contractor_id,
        'assignment_id',       v_route.assignment_id,
        'dispatch_method',     v_route.dispatch_method,
        'no_route_reason',     v_route.no_route_reason,
        'delivery_status',     v_status,
        'enqueued_via',        'sprint6_backfill',
        'triggered_at',        now()
      )
    );
  END LOOP;

  RAISE NOTICE 'Sprint 6 backfill: enqueued % deliveries', v_count;
END $$;