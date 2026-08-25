-- ============================================================
-- Migration: Update Service RPCs for Shift-Based Worker Rates
-- Updates release_worker and generate_monthly_billing to use
-- rate_10hr and rate_24hr based on the service's hours_per_day.
-- ============================================================

-- 1. Helper to resolve worker rate based on service hours
CREATE OR REPLACE FUNCTION public.get_worker_shift_rate(
    p_worker_id UUID,
    p_hours_per_day NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_r10 NUMERIC;
    v_r24 NUMERIC;
BEGIN
    SELECT COALESCE(rate_10hr, 0), COALESCE(rate_24hr, 800)
    INTO v_r10, v_r24
    FROM public.employees
    WHERE id = p_worker_id;

    IF p_hours_per_day > 10 THEN
        RETURN v_r24;
    ELSE
        RETURN v_r10;
    END IF;
END;
$$;

-- 2. Update release_worker
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

    -- Close the assignment
    UPDATE public.service_worker_assignments
    SET end_date = p_release_date, updated_at = NOW()
    WHERE id = p_assignment_id;

    -- Resolve worker daily rate based on service hours
    v_worker_daily_rate := public.get_worker_shift_rate(v_emp.id, COALESCE(v_service.hours_per_day, 10));

    -- Generate final payslip if there are unpaid days
    IF v_period_start <= p_release_date THEN
        v_days_counted := public.calc_days_worked(v_asgn.employee_id, v_period_start, p_release_date);

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
            p_release_date,
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
    IF v_service.legacy_assignment_id IS NOT NULL THEN
        UPDATE public.worker_assignments
        SET assignment_status = 'completed', end_date = p_release_date
        WHERE id = v_service.legacy_assignment_id;
    END IF;

    -- Also clear the assigned worker from the lead card if this was the worker
    UPDATE public.crm_leads
    SET assigned_worker_name = NULL
    WHERE phone = (SELECT phone FROM public.clients WHERE id = v_service.client_id LIMIT 1)
      AND assigned_worker_name = v_emp.full_name;

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', p_assignment_id,
        'days_counted', v_days_counted,
        'payroll_id', v_payroll_id
    );
END;
$$;

-- 3. Update generate_monthly_billing
CREATE OR REPLACE FUNCTION public.generate_monthly_billing(
    p_month_start DATE,
    p_month_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_svc RECORD;
    v_asgn RECORD;
    v_days_in_period NUMERIC;
    v_asgn_start DATE;
    v_asgn_end DATE;
    v_days_counted NUMERIC;
    v_bill_amount NUMERIC;
    v_client_name TEXT;
    v_emp RECORD;
    v_worker_daily_rate NUMERIC;
    v_bills_created INT := 0;
    v_payslips_created INT := 0;
BEGIN
    -- For each active service
    FOR v_svc IN
        SELECT * FROM public.services
        WHERE status = 'active'
          AND start_date <= p_month_end
    LOOP
        -- Check if a bill already exists for this period
        IF EXISTS (
            SELECT 1 FROM public.service_bills
            WHERE service_id = v_svc.id
              AND period_start = p_month_start
              AND period_end = p_month_end
              AND type = 'recurring'
        ) THEN
            CONTINUE;
        END IF;

        -- Calculate service days in this billing period
        v_asgn_start := GREATEST(v_svc.start_date, p_month_start);
        v_asgn_end := p_month_end;
        v_days_in_period := (v_asgn_end - v_asgn_start) + 1;

        -- Bill using complete_month_daily_rate (prorated for the days active)
        v_bill_amount := v_days_in_period * COALESCE(v_svc.complete_month_daily_rate, 0);

        -- Create client bill
        INSERT INTO public.service_bills (
            service_id, period_start, period_end,
            total_days, daily_rate_used, amount,
            type, deposit_applied, deposit_settled
        ) VALUES (
            v_svc.id, p_month_start, p_month_end,
            v_days_in_period, v_svc.complete_month_daily_rate, v_bill_amount,
            'recurring', 0, false
        );
        v_bills_created := v_bills_created + 1;

        -- Generate worker payslips for each assignment on this service
        FOR v_asgn IN
            SELECT * FROM public.service_worker_assignments
            WHERE service_id = v_svc.id
              AND start_date <= p_month_end
              AND (end_date IS NULL OR end_date >= p_month_start)
        LOOP
            -- Check if payslip already exists
            IF EXISTS (
                SELECT 1 FROM public.payroll
                WHERE assignment_id = v_asgn.id
                  AND period_start = p_month_start
                  AND period_end = p_month_end
            ) THEN
                CONTINUE;
            END IF;

            SELECT * INTO v_emp FROM public.employees WHERE id = v_asgn.employee_id;

            -- Calculate days for this specific assignment
            v_asgn_start := GREATEST(v_asgn.start_date, p_month_start);
            v_asgn_end := LEAST(COALESCE(v_asgn.end_date, p_month_end), p_month_end);
            v_days_counted := public.calc_days_worked(v_asgn.employee_id, v_asgn_start, v_asgn_end);

            v_worker_daily_rate := public.get_worker_shift_rate(v_emp.id, COALESCE(v_svc.hours_per_day, 10));

            SELECT COALESCE(c.client_name, 'Unknown') INTO v_client_name
            FROM public.clients c WHERE c.id = v_svc.client_id;

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
                0,  -- deposit is handled at service level, not payslip level
                v_days_counted * v_worker_daily_rate,
                'Pending Payment',
                v_svc.id,
                v_asgn.id,
                p_month_start,
                p_month_end,
                v_days_counted,
                'recurring',
                v_emp.id
            );
            v_payslips_created := v_payslips_created + 1;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'bills_created', v_bills_created,
        'payslips_created', v_payslips_created,
        'period', p_month_start::TEXT || ' to ' || p_month_end::TEXT
    );
END;
$$;
