-- ============================================================
-- Migration: Fix Attendance Half-Day Calculations and Summary
-- Accurately calculates half-days as 0.5 in calc_days_worked
-- and provides accurate attendance counts in summary RPC
-- ============================================================

-- 1. Update calc_days_worked to accurately sum worked days including 0.5 for half-days
CREATE OR REPLACE FUNCTION public.calc_days_worked(
    p_worker_id UUID,
    p_start DATE,
    p_end DATE
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_has_records BOOLEAN;
    v_days_worked NUMERIC;
    v_calendar_days NUMERIC;
BEGIN
    -- Check if granular attendance records exist for this worker in this date range
    SELECT EXISTS (
        SELECT 1 FROM public.attendance
        WHERE worker_id = p_worker_id
          AND duty_date >= p_start
          AND duty_date <= p_end
    ) INTO v_has_records;

    IF v_has_records THEN
        SELECT COALESCE(SUM(
            CASE 
                WHEN is_half_day = true OR status = 'Half Day' THEN 0.5
                WHEN is_absent = true OR status IN ('Absent', 'absent') THEN 0
                WHEN status IN ('Present', 'present', 'On Duty') THEN 1
                ELSE 0
            END
        ), 0) INTO v_days_worked
        FROM public.attendance
        WHERE worker_id = p_worker_id
          AND duty_date >= p_start
          AND duty_date <= p_end;

        RETURN v_days_worked;
    ELSE
        -- Fallback: calendar days if no explicit records exist
        v_calendar_days := (p_end - p_start) + 1;
        RETURN GREATEST(0, v_calendar_days);
    END IF;
END;
$$;

-- 2. Update get_assignment_attendance_summary to support both legacy and service assignments
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
    SELECT start_date::date, COALESCE(end_date::date, CURRENT_DATE), employee_id
    INTO v_start, v_end, v_employee_id
    FROM public.service_worker_assignments
    WHERE id = p_assignment_id;
  END IF;

  IF v_start IS NULL OR v_employee_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Return aggregated stats based on worker_id and duty_date range
  RETURN QUERY
  SELECT
    (v_end - v_start + 1)::INTEGER                                              AS total_days,
    COALESCE(SUM(CASE WHEN a.is_half_day = true OR a.status = 'Half Day' THEN 0.5
                      WHEN a.status IN ('Present','present','On Duty') THEN 1
                      ELSE 0 END), 0)                                           AS days_present,
    COUNT(CASE WHEN a.is_absent = true OR a.status IN ('Absent','absent') THEN 1 END)::INTEGER AS days_absent,
    COUNT(CASE WHEN a.is_half_day = true OR a.status = 'Half Day' THEN 1 END)::INTEGER        AS days_half,
    COALESCE(SUM(a.hours_worked), 0)                                            AS hours_total
  FROM public.attendance a
  WHERE a.worker_id = v_employee_id
    AND a.duty_date::date BETWEEN v_start AND v_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calc_days_worked(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_assignment_attendance_summary(UUID) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
