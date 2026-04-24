alter table public.leads
  add column if not exists property_type_detail text,
  add column if not exists hoa_or_condo_complexity text,
  add column if not exists handoff_consent_status text;

comment on column public.leads.property_type_detail is 'Phase 10: human-context property type for contractor brief (single_family|condo|townhouse_villa|high_rise|multifamily_investment)';
comment on column public.leads.hoa_or_condo_complexity is 'Phase 10: HOA / engineering approval complexity hint (none|hoa_simple|hoa_complex|high_rise_engineering|unknown)';
comment on column public.leads.handoff_consent_status is 'Phase 10: explicit homeowner consent for warm contractor handoff (accepted_today|accepted_tomorrow|text_or_email_first|report_only|unknown)';