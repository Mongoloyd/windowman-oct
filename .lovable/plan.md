```
SYSTEM COMMAND: FIX fire_crm_handoff SEARCH_PATH WITH MINIMAL FORWARD MIGRATION
MODE: strict / database-only / forward-only / no-function-body-rewrite / no-runtime-code-changes

## Verification finding

The report is valid, with one important nuance:

- The repo contains multiple historical public.fire_crm_handoff() definitions with SECURITY DEFINER and SET search_path = public.
- The live database currently has public.fire_crm_handoff() as SECURITY DEFINER, but proconfig is NULL, meaning the deployed/current function has no fixed function-level search_path.
- Supabase linter confirms a current warning: Function Search Path Mutable.
- The current/live function body already schema-qualifies the sensitive application objects:
  - public.resolve_route_for_lead(...)
  - public.webhook_deliveries
  - public.lead_events
  - vault.decrypted_secrets
  - extensions.http_post(...)
- This is not related to scanner, OTP, Twilio, storage, RLS, frontend, or historical migrations.

## Validity verdict

Valid. The correct fix is a new forward-only migration that changes only the function-level search_path using ALTER FUNCTION.

Do not rewrite or redefine the function body unless ALTER FUNCTION fails.

## Implementation plan

1. Add one new Supabase migration only

Create a new timestamped migration:

supabase/migrations/YYYYMMDDHHMMSS_fix_fire_crm_handoff_search_path.sql

Migration content:

```sql
ALTER FUNCTION public.fire_crm_handoff()
SET search_path = '';

COMMENT ON FUNCTION public.fire_crm_handoff() IS
  'SECURITY DEFINER CRM handoff trigger function. Function-level search_path is fixed to empty string for Supabase linter compliance; function body must schema-qualify all application objects.';
```

This migration must only change the function configuration. It must not rewrite the function body.

2.   
Preserve security boundaries  


Do not touch:

-   
scan-quote  

-   
send-otp  

-   
verify-otp  

-   
Twilio settings/secrets  

-   
storage buckets or policies  

-   
RLS policies  

-   
frontend files  

-   
existing old migrations  

-   
Supabase Edge Functions  

-   
src/integrations/supabase/types.ts  


3.   
Validate after migration  


Run this pg_proc verification:

```
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'fire_crm_handoff';
```

Expected:

-   
security_definer = true  

-   
config includes search_path=  


Also verify the trigger still points to the function:

```
SELECT
  tgname,
  tgrelid::regclass AS table_name,
  tgfoid::regprocedure AS function_name
FROM pg_trigger
WHERE tgfoid = 'public.fire_crm_handoff()'::regprocedure;
```

Then run the Supabase linter again.

Expected:

-   
Function Search Path Mutable warning for [public.fire](http://public.fire)_crm_handoff is resolved.  


If ALTER FUNCTION fails or the linter still complains:

-   
stop  

-   
report the exact SQL error or linter output  

-   
do not attempt CREATE OR REPLACE FUNCTION without approval  


## Expected result

[public.fire](http://public.fire)_crm_handoff() remains functionally the same, but its SECURITY DEFINER execution context no longer depends on a mutable or broad search path. The linter warning for this function should clear without touching scanner, OTP, Twilio, Supabase storage, RLS, frontend paths, or historical migrations.

## Final report required

Report:

1.   
migration file created  

2.   
exact SQL used  

3.   
pg_proc verification result  

4.   
trigger verification result  

5.   
Supabase linter result  

6.   
confirmation no function body rewrite occurred  

7.   
confirmation no scanner/OTP/Twilio/frontend/storage/RLS changes occurred  


```

## Verdict

Your current pasted version is **not unsafe conceptually**, but it has a **dangerous Markdown auto-link bug** and still contains the phrase **“redefines the final function.”**

Fix those before sending.
```