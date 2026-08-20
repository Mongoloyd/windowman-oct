-- Make the server's session reuse contract race-safe for the exact WMChat
-- source. Production preflight on 2026-08-20 found zero duplicate session
-- groups for this source; CREATE UNIQUE INDEX fails closed if that changes.

CREATE UNIQUE INDEX IF NOT EXISTS leads_wmchat_session_id_unique
  ON public.leads (session_id)
  WHERE source = 'windowman-first-quote';

COMMENT ON INDEX public.leads_wmchat_session_id_unique IS
  'Race-safe idempotency key for capture-truth-gate-lead WMChat submissions.';

/*
MANUAL DOWN MIGRATION:

DROP INDEX IF EXISTS public.leads_wmchat_session_id_unique;
*/
