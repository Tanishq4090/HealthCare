-- Migration: Add missing columns to attendance table and update summary RPC
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

-- Redefine get_assignment_attendance_summary to query by worker_id and date range
CREATE OR REPLACE FUNCTION public.get_assignment_attendance_summary(p_assignment_id UUID)
RETURNS TABLE (
  total_days      INTEGER,
  days_present    NUMERIC,
  days_absent     INTEGER,
  days_half       INTEGER,
  hours_total     NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
  v_employee_id UUID;
BEGIN
  -- 1. Fetch assignment boundaries and worker ID
  SELECT start_date::date, COALESCE(end_date::date, CURRENT_DATE), employee_id
  INTO v_start, v_end, v_employee_id
  FROM public.worker_assignments
  WHERE id = p_assignment_id;

  IF v_start IS NULL OR v_employee_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Return aggregated stats based on worker_id and duty_date range
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
  WHERE a.worker_id = v_employee_id
    AND a.duty_date::date BETWEEN v_start AND v_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_assignment_attendance_summary(UUID) TO authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
