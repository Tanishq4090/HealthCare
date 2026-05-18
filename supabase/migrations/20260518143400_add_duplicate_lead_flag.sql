-- Add is_duplicate flag and duplicate_of_lead_id to crm_leads
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of_lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL;

-- Index for quick duplicate lookups
CREATE INDEX IF NOT EXISTS idx_crm_leads_is_duplicate ON public.crm_leads(is_duplicate) WHERE is_duplicate = TRUE;

COMMENT ON COLUMN public.crm_leads.is_duplicate IS 'True if this lead was intentionally created as a duplicate (e.g. different family member using same phone number)';
COMMENT ON COLUMN public.crm_leads.duplicate_of_lead_id IS 'Points to the original/primary lead this was duplicated from';
