-- Fix RLS for payroll
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users full access to payroll" ON public.payroll;
    
    CREATE POLICY "Allow anon and authenticated full access to payroll"
        ON public.payroll
        FOR ALL
        USING (true)
        WITH CHECK (true);
END $$;
