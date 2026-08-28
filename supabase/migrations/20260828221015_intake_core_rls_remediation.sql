DO $rls_policy_preflight$
DECLARE
  missing_or_changed_policies text;
  unexpected_policies text;
BEGIN
  SELECT string_agg(
    format('%I.%I policy %I', expected.schema_name, expected.table_name, expected.policy_name),
    ', '
    ORDER BY expected.table_name, expected.policy_name
  )
  INTO missing_or_changed_policies
  FROM (
    VALUES
      (
        'public',
        'leads',
        'leads_anon_insert_constrained',
        'PERMISSIVE',
        ARRAY['anon']::text[],
        'INSERT',
        NULL::text,
        '((phone_verified = false) AND (phone_verified_at IS NULL) AND (otp_state IS NULL) AND (otp_failure_count = 0) AND (otp_locked_until IS NULL) AND (report_unlocked_at IS NULL) AND (last_otp_verified_at IS NULL))'
      ),
      (
        'public',
        'leads',
        'session_scoped_select_leads',
        'PERMISSIVE',
        ARRAY['anon']::text[],
        'SELECT',
        '(session_id = ((current_setting(''request.headers''::text, true))::json ->> ''x-session-id''::text))',
        NULL::text
      ),
      (
        'public',
        'quote_files',
        'Allow anonymous insert on quote_files',
        'PERMISSIVE',
        ARRAY['anon']::text[],
        'INSERT',
        NULL::text,
        'true'
      ),
      (
        'public',
        'scan_sessions',
        'anon_insert_scan_sessions',
        'PERMISSIVE',
        ARRAY['anon']::text[],
        'INSERT',
        NULL::text,
        '(user_id IS NULL)'
      )
  ) AS expected(
    schema_name,
    table_name,
    policy_name,
    permissive,
    roles,
    command,
    using_expression,
    check_expression
  )
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies AS policy
    WHERE policy.schemaname = expected.schema_name
      AND policy.tablename = expected.table_name
      AND policy.policyname = expected.policy_name
      AND policy.permissive = expected.permissive
      AND policy.roles::text[] = expected.roles
      AND policy.cmd = expected.command
      AND policy.qual IS NOT DISTINCT FROM expected.using_expression
      AND policy.with_check IS NOT DISTINCT FROM expected.check_expression
  );

  IF missing_or_changed_policies IS NOT NULL THEN
    RAISE EXCEPTION
      'Intake-core RLS preflight failed; missing or changed policy contracts: %',
      missing_or_changed_policies;
  END IF;

  SELECT string_agg(
    format('%I.%I policy %I', policy.schemaname, policy.tablename, policy.policyname),
    ', '
    ORDER BY policy.tablename, policy.policyname
  )
  INTO unexpected_policies
  FROM pg_catalog.pg_policies AS policy
  WHERE policy.schemaname = 'public'
    AND policy.tablename IN ('leads', 'quote_files', 'scan_sessions')
    AND (policy.tablename, policy.policyname) NOT IN (
      ('leads', 'leads_anon_insert_constrained'),
      ('leads', 'session_scoped_select_leads'),
      ('quote_files', 'Allow anonymous insert on quote_files'),
      ('scan_sessions', 'anon_insert_scan_sessions')
    );

  IF unexpected_policies IS NOT NULL THEN
    RAISE EXCEPTION
      'Intake-core RLS preflight failed; unexpected policy contracts: %',
      unexpected_policies;
  END IF;
END
$rls_policy_preflight$;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_sessions ENABLE ROW LEVEL SECURITY;
