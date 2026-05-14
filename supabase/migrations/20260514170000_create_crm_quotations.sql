-- Migration: Create crm_quotations table
-- Date: 2026-05-14

CREATE TABLE IF NOT EXISTS public.crm_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_category TEXT,
  recipient_age_condition TEXT,
  hours_per_day NUMERIC,
  days_per_week NUMERIC,
  shift_type TEXT,
  start_date DATE,
  duration TEXT,
  complete_month_rate NUMERIC,
  incomplete_month_rate NUMERIC,
  setup_fee NUMERIC DEFAULT 0,
  deposit NUMERIC DEFAULT 0,
  estimated_monthly_total NUMERIC,
  inclusions JSONB DEFAULT '[]'::jsonb,
  message_template TEXT,
  language TEXT,
  custom_message TEXT,
  valid_until DATE,
  status TEXT DEFAULT 'sent', -- sent, accepted, rejected, expired
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_quotations_lead_id ON public.crm_quotations(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotations_created_at ON public.crm_quotations(created_at DESC);

ALTER TABLE public.crm_quotations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'crm_quotations' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON public.crm_quotations FOR ALL TO authenticated USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.crm_quotations IS 'Stores detailed service quotations sent to CRM leads.';
