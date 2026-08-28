-- pg-delta: transaction=false
-- Make the server's session reuse contract race-safe for the exact WMChat
-- source. Production preflight on 2026-08-20 found zero duplicate session
-- groups for this source; CREATE UNIQUE INDEX fails closed if that changes.

CREATE UNIQUE INDEX CONCURRENTLY leads_wmchat_session_id_unique
  ON public.leads (session_id)
  WHERE source = 'windowman-first-quote';

COMMENT ON INDEX public.leads_wmchat_session_id_unique IS
  'Race-safe idempotency key for capture-truth-gate-lead WMChat submissions.';

/*
MANUAL DOWN MIGRATION:

-- Run outside a transaction block.
DROP INDEX CONCURRENTLY IF EXISTS public.leads_wmchat_session_id_unique;
*/
