-- Run this snippet in your Supabase SQL Editor to ensure the CRM Dashboard can read assignment mappings effortlessly.

DO $$
BEGIN
    -- Drop the restrictive anon policy if it exists to allow full read-access for the CRM UI
    DROP POLICY IF EXISTS "worker_assignments: anon read via valid token" ON public.worker_assignments;
    
    -- Recreate an open read policy for anonymous/dashboard usage (since the CRM has no hard auth walls)
    CREATE POLICY "worker_assignments: allow dashboard reads"
        ON public.worker_assignments
        FOR SELECT
        USING (true);
END $$;
