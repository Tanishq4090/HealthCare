CREATE TABLE IF NOT EXISTS public.crm_call_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    call_id TEXT NOT NULL UNIQUE,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    phone_number TEXT,
    duration_seconds INTEGER,
    intent TEXT,
    summary TEXT,
    transcript TEXT,
    recording_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: In Supabase, make sure RLS is configured appropriately if needed, or disable it
ALTER TABLE public.crm_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access" ON public.crm_call_logs
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
    
-- Allow anon edge functions to insert
CREATE POLICY "Allow anon insert" ON public.crm_call_logs
    FOR INSERT
    TO anon
    WITH CHECK (true);
