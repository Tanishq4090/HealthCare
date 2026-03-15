-- 001_initial_schema.sql
-- Core CRM Schema for 99Care

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE lead_status AS ENUM (
    'new', 'inquiry', 'quote_sent', 'form_submitted', 
    'staff_searching', 'staff_confirmed', 'deposit_pending', 
    'deposit_received', 'active', 'monthly_billing', 'closed'
);

-- 1. Workers (Staff)
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    whatsapp_number TEXT UNIQUE,
    languages TEXT[],
    skills TEXT[],
    area TEXT,
    gender TEXT,
    availability TEXT DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Clients
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_code TEXT UNIQUE,
    name TEXT NOT NULL,
    phone_number TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Leads (WhatsApp Inquiries)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone_number TEXT NOT NULL,
    status lead_status DEFAULT 'new',
    current_bot_state TEXT DEFAULT 'start',
    inquiry_answers JSONB DEFAULT '{}'::jsonb,
    score INTEGER DEFAULT 0,
    converted_client_id UUID REFERENCES public.clients(id),
    status_override BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Service Requests
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    shift_type TEXT,
    hourly_rate NUMERIC(8,2),
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Staff Assignments
CREATE TABLE IF NOT EXISTS public.staff_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    hourly_rate NUMERIC(8,2),
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Re-create or Alter Attendance to match what 004 expects
-- (since 20260312000000_create_attendance_table.sql exists, we'll alter it if needed, or create a full version here)
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.staff_assignments(id) ON DELETE CASCADE,
    duty_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in TIMESTAMPTZ, -- mentioned in 004
    hours_worked NUMERIC(5,2) DEFAULT 0,
    is_absent BOOLEAN DEFAULT false,
    is_leave BOOLEAN DEFAULT false,
    check_in_method TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'On Duty',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    type TEXT, -- 'deposit' or 'monthly'
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT now(),
    recorded_by TEXT DEFAULT 'auto', -- 'auto' or 'admin'
    transaction_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Communications (WhatsApp logs)
CREATE TABLE IF NOT EXISTS public.communications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    direction TEXT NOT NULL, -- 'inbound' or 'outbound'
    message_body TEXT,
    message_sid TEXT UNIQUE,
    sent_at TIMESTAMPTZ DEFAULT now()
);

-- Dummy RPCs for calculation mentioned in HANDOFF
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
BEGIN
    RETURN 50; -- Default score
END;
$$;

CREATE OR REPLACE FUNCTION match_staff(p_service TEXT, p_languages TEXT[], p_gender TEXT, p_area TEXT)
RETURNS TABLE (
    worker_id UUID,
    name TEXT,
    score INTEGER
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY SELECT id, w.name, 100 FROM public.workers w LIMIT 5;
END;
$$;
