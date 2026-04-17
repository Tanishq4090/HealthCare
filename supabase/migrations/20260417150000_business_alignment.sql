-- ============================================================
-- Migration: Alignment of Worker Business Logic
-- Purpose: Remove deposit/department, add services/payment models
-- Date: 2026-04-17
-- ============================================================

-- 1. Alter Employees Table
ALTER TABLE public.employees
    DROP COLUMN IF EXISTS department,
    DROP COLUMN IF EXISTS deposit_received,
    ADD COLUMN IF NOT EXISTS preferred_payment_type text DEFAULT 'monthly' CHECK (preferred_payment_type IN ('hourly', 'monthly', 'short_term')),
    ADD COLUMN IF NOT EXISTS services text[] DEFAULT '{}';

-- 2. Alter Worker Assignments Table (Client pays tracking)
ALTER TABLE public.worker_assignments
    ADD COLUMN IF NOT EXISTS deposit_paid numeric DEFAULT 0;

COMMENT ON COLUMN public.employees.preferred_payment_type IS 'Tracks how the worker is typically paid: hourly, monthly, or short_term.';
COMMENT ON COLUMN public.employees.services IS 'Array of services/skills the worker can provide.';
COMMENT ON COLUMN public.worker_assignments.deposit_paid IS 'Tracks the amount of deposit paid by the client prior to/at assignment.';
