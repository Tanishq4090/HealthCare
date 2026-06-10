-- Migration to add a client_work_forms table to track baby_care and patient_care work forms
CREATE TABLE IF NOT EXISTS public.client_work_forms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    form_type TEXT NOT NULL, -- 'baby_care_form' or 'patient_care_form'
    patient_name TEXT,
    duties JSONB DEFAULT '[]'::jsonb,
    other_work TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.client_work_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users"
ON public.client_work_forms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for all authenticated users"
ON public.client_work_forms FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for all authenticated users"
ON public.client_work_forms FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable delete for all authenticated users"
ON public.client_work_forms FOR DELETE
TO authenticated
USING (true);

-- Index for fast lookup by lead
CREATE INDEX IF NOT EXISTS idx_client_work_forms_lead_id ON public.client_work_forms(lead_id);
