-- ============================================================
-- Migration: Service Lifecycle Model
-- Creates services + service_worker_assignments tables,
-- updates payroll with new tracking fields,
-- creates service_bills for client invoicing,
-- and migrates existing worker_assignments data.
-- ============================================================

-- 1. Add complete/incomplete month daily rate columns to crm_leads
--    (These complement the existing quoted_monthly_rate / quoted_daily_rate)
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS complete_month_daily_rate NUMERIC,
ADD COLUMN IF NOT EXISTS incomplete_month_daily_rate NUMERIC;

COMMENT ON COLUMN public.crm_leads.complete_month_daily_rate IS 'Daily rate charged when service duration >= 30 days (cheaper long-term rate).';
COMMENT ON COLUMN public.crm_leads.incomplete_month_daily_rate IS 'Daily rate charged when service duration < 30 days (short-term rate).';

-- 2. Create services table
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    service_type TEXT,
    hours_per_day NUMERIC DEFAULT 10,
    start_date DATE NOT NULL,
    end_date DATE,                -- optional target/estimate; NOT enforcement
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    deposit_amount NUMERIC DEFAULT 0,
    deposit_status TEXT DEFAULT 'pending' CHECK (deposit_status IN ('pending', 'collected', 'settled')),
    complete_month_daily_rate NUMERIC DEFAULT 0,
    incomplete_month_daily_rate NUMERIC DEFAULT 0,
    notes TEXT,
    legacy_assignment_id UUID,    -- tracks which worker_assignment this was migrated from
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_client_id ON public.services(client_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON public.services(status);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'services' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Allow anon access for edge functions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'services' AND policyname = 'Allow all for anon'
  ) THEN
    CREATE POLICY "Allow all for anon" ON public.services FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.services IS 'Represents an open-ended service agreement with a client. Services stay active until explicitly ended.';

-- 3. Create service_worker_assignments table
CREATE TABLE IF NOT EXISTS public.service_worker_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,                -- NULL = ongoing assignment
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swa_service_id ON public.service_worker_assignments(service_id);
CREATE INDEX IF NOT EXISTS idx_swa_employee_id ON public.service_worker_assignments(employee_id);

ALTER TABLE public.service_worker_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'service_worker_assignments' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON public.service_worker_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'service_worker_assignments' AND policyname = 'Allow all for anon'
  ) THEN
    CREATE POLICY "Allow all for anon" ON public.service_worker_assignments FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.service_worker_assignments IS 'Links workers to services. Multiple workers can be assigned concurrently to the same service.';

-- 4. Update payroll table with new tracking fields
ALTER TABLE public.payroll
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assignment_id UUID,
ADD COLUMN IF NOT EXISTS days_counted NUMERIC,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'recurring',
ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- Note: period_start and period_end already exist from the original migration.
-- assignment_id already existed as a text column; we add it as UUID if not present.
-- total_amount already existed from a later migration.

-- 5. Create service_bills table (client-facing invoices)
CREATE TABLE IF NOT EXISTS public.service_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_days NUMERIC NOT NULL DEFAULT 0,
    daily_rate_used NUMERIC NOT NULL DEFAULT 0,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT DEFAULT 'recurring' CHECK (type IN ('recurring', 'final')),
    deposit_applied NUMERIC DEFAULT 0,
    deposit_settled BOOLEAN DEFAULT FALSE,
    settlement_amount NUMERIC DEFAULT 0,  -- positive = client owes, negative = refund
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_bills_service_id ON public.service_bills(service_id);

ALTER TABLE public.service_bills ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'service_bills' AND policyname = 'Allow all for authenticated'
  ) THEN
    CREATE POLICY "Allow all for authenticated" ON public.service_bills FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'service_bills' AND policyname = 'Allow all for anon'
  ) THEN
    CREATE POLICY "Allow all for anon" ON public.service_bills FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.service_bills IS 'Client-facing invoices generated monthly or at service closure.';

-- 6. Data Migration: worker_assignments → services + service_worker_assignments
DO $$
DECLARE
    r RECORD;
    new_service_id UUID;
    v_start DATE;
    v_deposit NUMERIC;
    v_billing_rate NUMERIC;
BEGIN
    FOR r IN SELECT wa.*, c.client_name, cl.complete_month_daily_rate AS lead_cm_rate, cl.incomplete_month_daily_rate AS lead_icm_rate
             FROM public.worker_assignments wa
             LEFT JOIN public.clients c ON c.id = wa.client_id
             LEFT JOIN public.crm_leads cl ON cl.id = wa.client_id
    LOOP
        v_start := COALESCE(r.start_date::DATE, (r.assigned_at AT TIME ZONE 'UTC')::DATE, CURRENT_DATE);
        v_deposit := COALESCE(r.deposit_amount, r.deposit_paid, 0);
        v_billing_rate := COALESCE(r.client_billing_rate, 0);

        -- Create Service
        INSERT INTO public.services (
            client_id, lead_id, service_type, hours_per_day, start_date, end_date, 
            status, deposit_amount, deposit_status,
            complete_month_daily_rate, incomplete_month_daily_rate,
            notes, legacy_assignment_id
        ) VALUES (
            r.client_id,
            r.client_id,  -- lead_id same as client_id in this system
            r.service_type, 
            COALESCE(r.hours_per_day, 10), 
            v_start, 
            r.end_date::DATE,
            CASE WHEN r.assignment_status = 'active' THEN 'active' ELSE 'ended' END,
            v_deposit,
            CASE WHEN v_deposit > 0 THEN 'collected' ELSE 'pending' END,
            COALESCE(r.lead_cm_rate, v_billing_rate, 850),
            COALESCE(r.lead_icm_rate, v_billing_rate, 1500),
            r.notes,
            r.id
        ) RETURNING id INTO new_service_id;

        -- Create Worker Assignment
        INSERT INTO public.service_worker_assignments (
            service_id, employee_id, start_date, end_date
        ) VALUES (
            new_service_id, 
            r.employee_id, 
            v_start, 
            CASE WHEN r.assignment_status = 'active' THEN NULL ELSE COALESCE(r.end_date::DATE, CURRENT_DATE) END
        );
    END LOOP;
END $$;
