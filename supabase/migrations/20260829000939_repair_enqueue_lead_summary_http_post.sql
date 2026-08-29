DO $preflight$
DECLARE
  http_post_oid oid;
  http_post_argument_names text[];
  http_post_result text;
BEGIN
  http_post_oid := pg_catalog.to_regprocedure(
    'net.http_post(text,jsonb,jsonb,jsonb,integer)'
  );

  IF http_post_oid IS NULL THEN
    RAISE EXCEPTION
      'Required pg_net function net.http_post(text,jsonb,jsonb,jsonb,integer) is missing';
  END IF;

  SELECT p.proargnames, pg_catalog.pg_get_function_result(p.oid)
  INTO http_post_argument_names, http_post_result
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = http_post_oid;

  IF http_post_argument_names IS DISTINCT FROM ARRAY[
    'url',
    'body',
    'params',
    'headers',
    'timeout_milliseconds'
  ]::text[] THEN
    RAISE EXCEPTION
      'Required pg_net function has unexpected named arguments: %',
      http_post_argument_names;
  END IF;

  IF http_post_result IS DISTINCT FROM 'bigint' THEN
    RAISE EXCEPTION
      'Required pg_net function has unexpected result type: %',
      http_post_result;
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.enqueue_lead_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  headers_raw text;
  auth_header text;
  project_url text;
  changed boolean;
begin
  IF NEW.is_test THEN
    RETURN NEW;
  END IF;

  if tg_op = 'UPDATE' then
    changed := (
      (to_jsonb(new) - 'ai_summary' - 'updated_at')
      is distinct from
      (to_jsonb(old) - 'ai_summary' - 'updated_at')
    );

    if not changed then
      return new;
    end if;
  end if;

  headers_raw := current_setting('request.headers', true);
  auth_header := case
    when headers_raw is not null then (headers_raw::json ->> 'authorization')
    else null
  end;

  if auth_header is null or btrim(auth_header) = '' then
    return new;
  end if;

  select ds.decrypted_secret
  into project_url
  from "vault"."decrypted_secrets" ds
  where ds.name = 'project_url'
  limit 1;

  if project_url is null then
    return new;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/summarize-row',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', auth_header
    ),
    body := jsonb_build_object(
      'schema', 'public',
      'table', 'leads',
      'idColumn', 'id',
      'id', new.id,
      'writeBack', true,
      'summaryColumn', 'ai_summary',
      'columns', jsonb_build_array(
        'id','created_at','updated_at','first_name','last_name','email','phone_e164','city','county',
        'project_type','window_count','quote_range','status','deal_status','source',
        'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
        'phone_verified','report_unlocked_at','last_call_status','last_call_outcome',
        'handoff_consent_status','property_type_detail','hoa_or_condo_complexity'
      ),
      'instructions', 'Summarize this lead for internal CRM use. Include identity/contact completeness, stage, urgency, attribution hints, and next best action in 3-6 bullets.'
    )
  );

  return new;
exception
  when others then
    return new;
end;
$function$;
