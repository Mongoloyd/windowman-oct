-- Meta Intake Lab mapping decisions. This table is intentionally isolated
-- from browser roles; admin users reach it only through the authorized
-- meta-intake-replay Edge Function.

create table public.field_mapping_overrides (
  id bigint generated always as identity primary key,
  form_id text not null,
  question_label text not null,
  mapping_action text not null,
  canonical_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint field_mapping_overrides_form_id_not_blank
    check (char_length(btrim(form_id)) between 1 and 255),
  constraint field_mapping_overrides_question_label_not_blank
    check (char_length(btrim(question_label)) between 1 and 500),
  constraint field_mapping_overrides_action_check
    check (mapping_action in ('map', 'ignore')),
  constraint field_mapping_overrides_action_key_check
    check (
      (mapping_action = 'ignore' and canonical_key is null)
      or
      (
        mapping_action = 'map'
        and canonical_key is not null
        and canonical_key in (
          'first_name',
          'last_name',
          'email',
          'phone_e164',
          'county',
          'city',
          'zip',
          'project_type',
          'property_type',
          'property_type_detail',
          'quote_range',
          'qualification_openings'
        )
      )
    ),
  constraint field_mapping_overrides_form_question_unique
    unique (form_id, question_label)
);

create index field_mapping_overrides_form_id_idx
  on public.field_mapping_overrides (form_id);

create trigger field_mapping_overrides_set_updated_at
  before update on public.field_mapping_overrides
  for each row
  execute function public.set_updated_at();

alter table public.field_mapping_overrides enable row level security;

revoke all on table public.field_mapping_overrides
  from public, anon, authenticated;
revoke all on sequence public.field_mapping_overrides_id_seq
  from public, anon, authenticated;

grant select, insert, update, delete on table public.field_mapping_overrides
  to service_role;
grant usage, select on sequence public.field_mapping_overrides_id_seq
  to service_role;

comment on table public.field_mapping_overrides is
  'Admin-reviewed Meta form field mappings. Live normalization does not consume these overrides yet.';
comment on column public.field_mapping_overrides.canonical_key is
  'Allowlisted lead destination or qualification key; null only when mapping_action is ignore.';
