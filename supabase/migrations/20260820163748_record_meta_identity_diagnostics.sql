-- Record the identity-quality decision on every platform dispatch row and keep
-- a durable diagnostic that is not cleared when the worker marks a row sent.
ALTER TABLE public.wm_platform_dispatch_log
  ADD COLUMN IF NOT EXISTS identity_quality text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS diagnostic_reason text;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    WHERE c.conrelid = 'public.wm_platform_dispatch_log'::regclass
      AND c.conname = 'wm_platform_dispatch_log_identity_quality_check'
  ) THEN
    ALTER TABLE public.wm_platform_dispatch_log
      ADD CONSTRAINT wm_platform_dispatch_log_identity_quality_check
      CHECK (identity_quality = ANY (ARRAY['unknown', 'low', 'medium', 'high']::text[]));
  END IF;
END
$constraint$;

COMMENT ON COLUMN public.wm_platform_dispatch_log.identity_quality IS
  'Canonical identity quality recorded at dispatch-row creation; diagnostic only for WMChat lead_captured.';

COMMENT ON COLUMN public.wm_platform_dispatch_log.diagnostic_reason IS
  'Durable non-PII policy diagnostic retained after dispatch status changes.';
