-- Sprint 1N follow-up: tighten grants/linter surface for the new outbox tables.
-- Service role retains elevated access through its database role; remove explicit
-- always-true policies and make table/function grants explicit for app roles.

DROP POLICY IF EXISTS platform_dispatch_outbox_service_role_all ON public.platform_dispatch_outbox;
DROP POLICY IF EXISTS platform_dispatch_attempts_service_role_all ON public.platform_dispatch_attempts;

REVOKE ALL ON TABLE public.platform_dispatch_outbox FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_dispatch_outbox FROM anon;
REVOKE ALL ON TABLE public.platform_dispatch_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_dispatch_attempts FROM anon;

GRANT SELECT ON TABLE public.platform_dispatch_outbox TO authenticated;
GRANT SELECT ON TABLE public.platform_dispatch_attempts TO authenticated;
GRANT ALL ON TABLE public.platform_dispatch_outbox TO service_role;
GRANT ALL ON TABLE public.platform_dispatch_attempts TO service_role;

COMMENT ON TABLE public.platform_dispatch_outbox IS
  'Dry-run-only platform dispatch outbox contract. Anon/PUBLIC grants are revoked; authenticated reads are gated by internal-operator RLS; service_role retains elevated database access. Live dispatch fields are blocked by constraints and triggers until a future explicit migration.';
COMMENT ON TABLE public.platform_dispatch_attempts IS
  'Future attempt audit table constrained to non-sending statuses for Sprint 1N. Anon/PUBLIC grants are revoked; authenticated reads are gated by internal-operator RLS.';