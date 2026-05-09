-- Add missing columns to workers table (Resilient)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers') THEN
        ALTER TABLE public.workers 
        ADD COLUMN IF NOT EXISTS aadhaar_number TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS dob DATE;
    END IF;
END $$;
