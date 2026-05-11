-- Migration: Create crm_lead_activity table for Activity Timeline
-- Date: 2026-05-11

CREATE TABLE IF NOT EXISTS public.crm_lead_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  -- event_type values: 'lead_created', 'stage_changed', 'greeting_sent',
  --                    'form_filled', 'quotation_sent', 'consent_sent',
  --                    'call_received', 'note_added'
  description TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_lead_activity_lead_id ON public.crm_lead_activity(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_activity_created_at ON public.crm_lead_activity(created_at DESC);

ALTER TABLE public.crm_lead_activity ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'crm_lead_activity' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON public.crm_lead_activity FOR ALL TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'crm_lead_activity' AND policyname = 'Allow all for service_role'
  ) THEN
    CREATE POLICY "Allow all for service_role" ON public.crm_lead_activity FOR ALL TO service_role USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.crm_lead_activity IS 'Audit log of key events for each CRM lead. Powers the Activity Timeline in the inspector panel.';
