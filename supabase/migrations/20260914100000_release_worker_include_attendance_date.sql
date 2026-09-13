-- ============================================================
-- Migration: Release Worker Include Release Date Attendance
-- Ensures that when a worker is released on a given date,
-- any attendance marked for that day (or during that period)
-- is always included and counted in the assignment end_date,
-- calc_days_worked, get_assignment_attendance_summary, and final payroll.
-- ============================================================

-- 1. Update release_worker to ensure release date encompasses any logged attendance
CREATE OR REPLACE FUNCTION public.release_worker(
    p_assignment_id UUID,
    p_release_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asgn RECORD;
    v_service RECORD;
    v_emp RECORD;
    v_last_payroll_end DATE;
    v_period_start DATE;
    v_effective_release_date DATE;
    v_days_counted NUMERIC;
    v_client_name TEXT;
    v_payroll_id UUID;
    v_worker_daily_rate NUMERIC;
BEGIN
    -- Get assignment
    SELECT * INTO v_asgn FROM public.service_worker_assignments WHERE id = p_assignment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Assignment not found');
    END IF;
    IF v_asgn.end_date IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Assignment already ended');
    END IF;

    -- Get service and employee
    SELECT * INTO v_service FROM public.services WHERE id = v_asgn.service_id;
    SELECT * INTO v_emp FROM public.employees WHERE id = v_asgn.employee_id;

    -- Determine period start
    SELECT MAX(period_end) INTO v_last_payroll_end
    FROM public.payroll
    WHERE assignment_id = p_assignment_id
      AND service_id = v_asgn.service_id;

    IF v_last_payroll_end IS NOT NULL THEN
        v_period_start := v_last_payroll_end + 1;
    ELSE
        v_period_start := v_asgn.start_date;
    END IF;

    -- Determine effective release date:
    -- Ensure it is at least p_release_date, but also at least the maximum duty_date 
    -- of any attendance already logged for this worker in this period!
    SELECT GREATEST(
        COALESCE(p_release_date, CURRENT_DATE),
        COALESCE((
            SELECT MAX(duty_date)
            FROM public.attendance
            WHERE worker_id = v_asgn.employee_id
              AND duty_date >= v_period_start
        ), COALESCE(p_release_date, CURRENT_DATE))
    ) INTO v_effective_release_date;

    -- Close the assignment
    UPDATE public.service_worker_assignments
    SET end_date = v_effective_release_date, updated_at = NOW()
    WHERE id = p_assignment_id;

    -- Resolve worker daily rate based on service hours
    v_worker_daily_rate := public.get_worker_shift_rate(v_emp.id, COALESCE(v_service.hours_per_day, 10));

    -- Generate final payslip if there are unpaid days
    IF v_period_start <= v_effective_release_date THEN
        v_days_counted := public.calc_days_worked(v_asgn.employee_id, v_period_start, v_effective_release_date);

        SELECT COALESCE(c.client_name, 'Unknown') INTO v_client_name
        FROM public.clients c WHERE c.id = v_service.client_id;

        INSERT INTO public.payroll (
            worker, client_name, days_worked, daily_rate, total_amount,
            deposit_received, net_balance, status,
            service_id, assignment_id, period_start, period_end,
            days_counted, type, worker_id
        ) VALUES (
            v_emp.full_name,
            v_client_name,
            v_days_counted,
            v_worker_daily_rate,
            v_days_counted * v_worker_daily_rate,
            0,
            v_days_counted * v_worker_daily_rate,
            'Pending Payment',
            v_service.id,
            p_assignment_id,
            v_period_start,
            v_effective_release_date,
            v_days_counted,
            'final',
            v_emp.id
        ) RETURNING id INTO v_payroll_id;
    END IF;

    -- Update employee status back to available
    UPDATE public.employees
    SET status = 'available', assigned_client = NULL, updated_at = NOW()
    WHERE id = v_asgn.employee_id;

    -- Also complete legacy worker_assignment if present
    UPDATE public.worker_assignments
    SET assignment_status = 'completed', end_date = v_effective_release_date
    WHERE (id = v_service.legacy_assignment_id 
           OR (employee_id = v_asgn.employee_id AND client_id = v_service.client_id AND assignment_status = 'active'));

    -- Also clear the assigned worker from the lead card if this was the worker
    UPDATE public.crm_leads
    SET assigned_worker_name = NULL
    WHERE phone = (SELECT phone FROM public.clients WHERE id = v_service.client_id LIMIT 1)
      AND assigned_worker_name = v_emp.full_name;

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', p_assignment_id,
        'release_date', v_effective_release_date,
        'days_counted', v_days_counted,
        'payroll_id', v_payroll_id
    );
END;
$$;

-- 2. Update get_assignment_attendance_summary to ensure end boundary includes logged attendance
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

  -- Ensure v_end encompasses at least any attendance already logged for this worker on or after v_start
  SELECT GREATEST(
    v_end,
    COALESCE((
      SELECT MAX(duty_date::date)
      FROM public.attendance
      WHERE worker_id = v_employee_id
        AND duty_date::date >= v_start
    ), v_end)
  ) INTO v_end;

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

GRANT EXECUTE ON FUNCTION public.release_worker(UUID, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_assignment_attendance_summary(UUID) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
