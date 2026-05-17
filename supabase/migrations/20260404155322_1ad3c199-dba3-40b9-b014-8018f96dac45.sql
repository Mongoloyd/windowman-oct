-- deal_status is referenced by CRM/admin paths but has no earlier CREATE migration in repo.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deal_status text;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_deal_status_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_deal_status_check CHECK (
  deal_status IS NULL OR deal_status IN (
    'new', 'attempted', 'in_conversation',
    'appointment_booked', 'ghosted',
    'open', 'won', 'lost', 'dead'
  )
);
