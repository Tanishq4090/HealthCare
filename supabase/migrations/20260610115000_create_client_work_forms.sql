-- Create table for storing client work duties form submissions
CREATE TABLE IF NOT EXISTS public.client_work_forms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    form_type TEXT NOT NULL, -- 'baby_care_form' or 'patient_care_form'
    patient_name TEXT,
    duties JSONB DEFAULT '[]'::jsonb, -- Array of selected duties
    other_work TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up RLS
ALTER TABLE public.client_work_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.client_work_forms;
CREATE POLICY "Enable read access for all authenticated users"
ON public.client_work_forms FOR SELECT
TO authenticated
USING (true);
