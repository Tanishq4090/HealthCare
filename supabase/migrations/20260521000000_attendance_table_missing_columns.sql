-- Migration: Add missing columns to attendance table
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'On Duty',
  ADD COLUMN IF NOT EXISTS hours_worked NUMERIC,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_absent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_leave BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update any existing rows to have default status if null
UPDATE public.attendance SET status = 'Present' WHERE status IS NULL;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
