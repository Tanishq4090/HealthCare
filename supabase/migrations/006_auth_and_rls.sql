-- 006_auth_and_rls.sql
-- Setting up Security Profiles and enforcing Row Level Security (RLS)

-- 1. Create Profiles Table to extend auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    accesses TEXT[] DEFAULT '{"crm", "clients", "hr", "finance"}',
    avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.5 Create Missing Tables IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.payroll (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id UUID REFERENCES public.workers(id),
    amount NUMERIC,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.duty_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_id UUID REFERENCES public.workers(id),
    client_id UUID REFERENCES public.clients(id),
    date DATE,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT,
    email TEXT,
    phone TEXT,
    message TEXT,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create generic policies (Allow only authenticated users)
-- Profiles
CREATE POLICY "Profiles are viewable by all authenticated users" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Workers
CREATE POLICY "Authenticated users can manage workers" ON public.workers FOR ALL USING (auth.role() = 'authenticated');

-- Clients
CREATE POLICY "Authenticated users can manage clients" ON public.clients FOR ALL USING (auth.role() = 'authenticated');

-- Leads (CRM Inquiries)
CREATE POLICY "Authenticated users can manage leads" ON public.leads FOR ALL USING (auth.role() = 'authenticated');

-- CRM Leads (Pipeline)
CREATE POLICY "Authenticated users can manage crm_leads" ON public.crm_leads FOR ALL USING (auth.role() = 'authenticated');

-- Attendance
CREATE POLICY "Authenticated users can manage attendance" ON public.attendance FOR ALL USING (auth.role() = 'authenticated');

-- Payroll
CREATE POLICY "Authenticated users can manage payroll" ON public.payroll FOR ALL USING (auth.role() = 'authenticated');

-- Duty Logs
CREATE POLICY "Authenticated users can manage duty logs" ON public.duty_logs FOR ALL USING (auth.role() = 'authenticated');

-- Contact Submissions (Public Website Data Pipeline)
-- Must allow anonymous visitors to insert, but NEVER read or delete
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert contact submissions" ON public.contact_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Only authenticated users can view/manage contact submissions" ON public.contact_submissions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Only authenticated users can update contact submissions" ON public.contact_submissions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Only authenticated users can delete contact submissions" ON public.contact_submissions FOR DELETE USING (auth.role() = 'authenticated');
