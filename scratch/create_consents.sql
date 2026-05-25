CREATE TABLE IF NOT EXISTS public.client_consents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    phone TEXT,
    relative_name TEXT,
    patient_name TEXT,
    age TEXT,
    weight TEXT,
    contact_number TEXT,
    alternate_contact_number TEXT,
    address TEXT,
    reference_by TEXT,
    service_start_date TEXT,
    service_category TEXT,
    offered_time TEXT,
    other_details TEXT,
    terms_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Give service role access
ALTER TABLE public.client_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.client_consents FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.client_consents FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.client_consents FOR UPDATE USING (true);
