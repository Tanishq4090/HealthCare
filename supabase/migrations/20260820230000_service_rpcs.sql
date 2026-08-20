-- ============================================================
-- RPCs for Service Lifecycle Management
-- ============================================================

-- ─── Helper: Calculate worker pay for a period ───────────────
-- Returns the number of days worked (calendar days minus absences)
CREATE OR REPLACE FUNCTION public.calc_days_worked(
    p_worker_id UUID,
    p_start DATE,
    p_end DATE
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_calendar_days NUMERIC;
    v_absences NUMERIC;
BEGIN
    v_calendar_days := (p_end - p_start) + 1;
    
    SELECT COUNT(*) INTO v_absences
    FROM public.attendance
    WHERE worker_id = p_worker_id
      AND duty_date >= p_start
      AND duty_date <= p_end
      AND (is_absent = true OR status = 'absent');

    RETURN GREATEST(0, v_calendar_days - COALESCE(v_absences, 0));
END;
$$;

-- ─── RPC: Release a single worker from a service ─────────────
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
            COALESCE(v_emp.monthly_daily_rate, 0),
            v_days_counted * COALESCE(v_emp.monthly_daily_rate, 0),
            COALESCE(v_emp.deposit_received, 0),
            (v_days_counted * COALESCE(v_emp.monthly_daily_rate, 0)) - COALESCE(v_emp.deposit_received, 0),
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

    -- Also complete legacy worker_assignment if present (so it hides from legacy Attendance tab)
    IF v_service.legacy_assignment_id IS NOT NULL THEN
        UPDATE public.worker_assignments
        SET assignment_status = 'completed', end_date = p_release_date
        WHERE id = v_service.legacy_assignment_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'assignment_id', p_assignment_id,
        'days_counted', v_days_counted,
        'payroll_id', v_payroll_id
    );
END;
$$;

-- ─── TRIGGER: Auto-release worker when status changes to 'available' ─────────
CREATE OR REPLACE FUNCTION public.trg_release_worker_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_asgn RECORD;
BEGIN
    IF NEW.status = 'available' AND OLD.status != 'available' THEN
        -- Find active assignments for this worker
        FOR v_asgn IN
            SELECT id FROM public.service_worker_assignments 
            WHERE employee_id = NEW.id AND end_date IS NULL
        LOOP
            PERFORM public.release_worker(v_asgn.id, CURRENT_DATE);
        END LOOP;
        
        -- Also clean up any loose legacy worker_assignments
        UPDATE public.worker_assignments
        SET assignment_status = 'completed', end_date = CURRENT_DATE
        WHERE employee_id = NEW.id AND assignment_status = 'active';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_release_worker_on_available ON public.employees;
CREATE TRIGGER trigger_release_worker_on_available
AFTER UPDATE OF status ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.trg_release_worker_on_status_change();

-- ─── RPC: End a service (with deposit settlement) ────────────
CREATE OR REPLACE FUNCTION public.end_service(
    p_service_id UUID,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_service RECORD;
    v_asgn RECORD;
    v_total_lifetime_days NUMERIC;
    v_applicable_rate NUMERIC;
    v_true_cost NUMERIC;
    v_billed_so_far NUMERIC;
    v_total_already_paid NUMERIC;
    v_settlement NUMERIC;
    v_released_count INT := 0;
BEGIN
    -- Get service
    SELECT * INTO v_service FROM public.services WHERE id = p_service_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Service not found');
    END IF;
    IF v_service.status = 'ended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Service already ended');
    END IF;

    -- 1. Auto-release all active worker assignments
    FOR v_asgn IN
        SELECT * FROM public.service_worker_assignments
        WHERE service_id = p_service_id AND end_date IS NULL
    LOOP
        PERFORM public.release_worker(v_asgn.id, p_end_date);
        v_released_count := v_released_count + 1;
    END LOOP;

    -- 2. Calculate true prorated service cost
    v_total_lifetime_days := (p_end_date - v_service.start_date) + 1;

    IF v_total_lifetime_days < 30 THEN
        v_applicable_rate := COALESCE(v_service.incomplete_month_daily_rate, 0);
    ELSE
        v_applicable_rate := COALESCE(v_service.complete_month_daily_rate, 0);
    END IF;

    v_true_cost := v_total_lifetime_days * v_applicable_rate;

    -- 3. Sum all previously billed amounts
    SELECT COALESCE(SUM(amount), 0) INTO v_billed_so_far
    FROM public.service_bills
    WHERE service_id = p_service_id;

    -- Total already paid = previous bills + deposit
    v_total_already_paid := v_billed_so_far + COALESCE(v_service.deposit_amount, 0);

    -- Settlement: positive means client owes more, negative means refund
    v_settlement := v_true_cost - v_total_already_paid;

    -- 4. Create final bill record
    INSERT INTO public.service_bills (
        service_id, period_start, period_end,
        total_days, daily_rate_used, amount,
        type, deposit_applied, deposit_settled,
        settlement_amount, notes
    ) VALUES (
        p_service_id,
        v_service.start_date,
        p_end_date,
        v_total_lifetime_days,
        v_applicable_rate,
        v_true_cost,
        'final',
        COALESCE(v_service.deposit_amount, 0),
        true,
        v_settlement,
        CASE
            WHEN v_settlement > 0 THEN 'Client owes ₹' || v_settlement::TEXT
            WHEN v_settlement < 0 THEN 'Refund ₹' || ABS(v_settlement)::TEXT || ' to client'
            ELSE 'Fully settled — no money movement'
        END
    );

    -- 5. Mark service as ended
    UPDATE public.services
    SET status = 'ended',
        end_date = p_end_date,
        deposit_status = 'settled',
        updated_at = NOW()
    WHERE id = p_service_id;

    RETURN jsonb_build_object(
        'success', true,
        'service_id', p_service_id,
        'total_lifetime_days', v_total_lifetime_days,
        'rate_used', v_applicable_rate,
        'true_cost', v_true_cost,
        'previously_billed', v_billed_so_far,
        'deposit', v_service.deposit_amount,
        'settlement', v_settlement,
        'workers_released', v_released_count
    );
END;
$$;

-- ─── RPC: Generate monthly billing for all active services ───
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

        -- Generate worker payslips for each active assignment on this service
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
                COALESCE(v_emp.monthly_daily_rate, 0),
                v_days_counted * COALESCE(v_emp.monthly_daily_rate, 0),
                0,  -- deposit is handled at service level, not payslip level
                v_days_counted * COALESCE(v_emp.monthly_daily_rate, 0),
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
