-- ============================================================
-- Migration: Attendance-Linked Payslip & Invoice System
-- Date: 2026-05-20
-- ============================================================

-- 1. Enhance worker_assignments with billing & invoice tracking
ALTER TABLE public.worker_assignments
  ADD COLUMN IF NOT EXISTS deposit_amount          NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_paid            NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_billing_rate     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payslip_generated       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS payslip_pdf_url         TEXT,
  ADD COLUMN IF NOT EXISTS final_invoice_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS final_invoice_url       TEXT,
  ADD COLUMN IF NOT EXISTS final_invoice_number    TEXT;

COMMENT ON COLUMN public.worker_assignments.deposit_amount IS 'Upfront deposit collected from the client.';
COMMENT ON COLUMN public.worker_assignments.advance_paid IS 'Mid-period advance payments made by client (reduces final balance).';
COMMENT ON COLUMN public.worker_assignments.client_billing_rate IS 'Daily rate charged to client (may differ from employee rate).';
COMMENT ON COLUMN public.worker_assignments.payslip_generated IS 'True once the worker payslip has been generated.';
COMMENT ON COLUMN public.worker_assignments.final_invoice_generated IS 'True once the final client invoice has been generated.';

-- 2. Enhance attendance table to link to assignments
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.worker_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_half_day   BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.attendance.assignment_id IS 'FK to worker_assignments — scopes attendance to a specific assignment period.';
COMMENT ON COLUMN public.attendance.is_half_day IS 'When true, this counts as 0.5 days for payroll calculation.';

-- 3. Enhance payroll table with full tracking
ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS assignment_id  UUID REFERENCES public.worker_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS worker_id      UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_amount   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payslip_type   TEXT DEFAULT 'worker'
    CHECK (payslip_type IN ('worker', 'client_invoice'));

COMMENT ON COLUMN public.payroll.assignment_id IS 'FK to worker_assignments — ties payslip to a specific assignment.';
COMMENT ON COLUMN public.payroll.payslip_type IS 'worker = staff payslip, client_invoice = client-facing invoice.';

-- 4. Backfill: link existing attendance records to assignments via employee_id match
-- (best-effort, links based on date range overlap)
UPDATE public.attendance att
SET assignment_id = wa.id
FROM public.worker_assignments wa
WHERE att.worker_id = wa.employee_id
  AND att.assignment_id IS NULL
  AND wa.start_date IS NOT NULL
  AND att.duty_date::date BETWEEN wa.start_date::date AND COALESCE(wa.end_date::date, CURRENT_DATE)
  AND wa.assignment_status = 'active';

-- 5. Create RPC: get_assignment_attendance_summary
-- Returns days_worked and days_absent for a given assignment
CREATE OR REPLACE FUNCTION public.get_assignment_attendance_summary(p_assignment_id UUID)
RETURNS TABLE (
  total_days    INTEGER,
  days_present  NUMERIC,
  days_absent   INTEGER,
  days_half     INTEGER,
  hours_total   NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
BEGIN
  SELECT start_date::date, COALESCE(end_date::date, CURRENT_DATE)
  INTO v_start, v_end
  FROM public.worker_assignments
  WHERE id = p_assignment_id;

  RETURN QUERY
  SELECT
    (v_end - v_start + 1)::INTEGER                                              AS total_days,
    COALESCE(SUM(CASE WHEN a.is_half_day THEN 0.5
                      WHEN a.status IN ('Present','present','On Duty') THEN 1
                      ELSE 0 END), 0)                                           AS days_present,
    COUNT(CASE WHEN a.status IN ('Absent','absent') THEN 1 END)::INTEGER        AS days_absent,
    COUNT(CASE WHEN a.is_half_day THEN 1 END)::INTEGER                          AS days_half,
    COALESCE(SUM(a.hours_worked), 0)                                            AS hours_total
  FROM public.attendance a
  WHERE a.assignment_id = p_assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_assignment_attendance_summary(UUID) TO authenticated;

-- ============================================================
-- EOF
-- ============================================================
