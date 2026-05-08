-- Migration: Add billing and duration fields to worker_assignments
-- Date: 2026-05-09

ALTER TABLE public.worker_assignments
ADD COLUMN IF NOT EXISTS start_date timestamptz,
ADD COLUMN IF NOT EXISTS end_date timestamptz,
ADD COLUMN IF NOT EXISTS service_type text CHECK (service_type IN ('one_day', 'date_range')),
ADD COLUMN IF NOT EXISTS hours_per_day numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bill_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_number text;

COMMENT ON COLUMN public.worker_assignments.start_date IS 'Start date of the service period.';
COMMENT ON COLUMN public.worker_assignments.end_date IS 'End date of the service period (if applicable).';
COMMENT ON COLUMN public.worker_assignments.service_type IS 'Type of service duration: one_day or date_range.';
COMMENT ON COLUMN public.worker_assignments.hours_per_day IS 'Number of hours per day for hourly/one_day services.';
COMMENT ON COLUMN public.worker_assignments.total_bill_amount IS 'Total calculated bill amount for this assignment.';
COMMENT ON COLUMN public.worker_assignments.invoice_number IS 'Unique invoice number for this assignment.';
