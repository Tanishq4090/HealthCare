-- Migration: Add paid_amount and paid_through_date to payroll
-- Supports partial payments and balance tracking for ongoing active workers
ALTER TABLE public.payroll
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_through_date DATE;
