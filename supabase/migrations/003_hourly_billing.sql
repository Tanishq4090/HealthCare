-- 003_hourly_billing.sql
-- Placeholder or additional billing structures

ALTER TABLE public.service_requests
ADD COLUMN IF NOT EXISTS hourly_billing_enabled BOOLEAN DEFAULT false;

-- Base implementation of calculate_monthly_bill before 004 overrides it
CREATE OR REPLACE FUNCTION calculate_monthly_bill(
  p_client_id   UUID,
  p_period_from DATE,
  p_period_to   DATE
)
RETURNS TABLE (
  assignment_id      UUID,
  service_request_id UUID,
  hourly_rate        NUMERIC,
  total_hours        NUMERIC,
  gross_amount       NUMERIC
) LANGUAGE sql AS $$
  SELECT
    sa.id                                             AS assignment_id,
    sa.service_request_id,
    COALESCE(sa.hourly_rate, sr.hourly_rate)          AS hourly_rate,
    COALESCE(SUM(a.hours_worked), 0)                  AS total_hours,
    COALESCE(SUM(a.hours_worked * COALESCE(sa.hourly_rate, sr.hourly_rate, 0)), 0) AS gross_amount
  FROM  staff_assignments sa
  JOIN  service_requests  sr ON sr.id = sa.service_request_id
  LEFT JOIN attendance    a
    ON  a.assignment_id = sa.id
    AND a.duty_date BETWEEN p_period_from AND p_period_to
    AND a.is_absent  = FALSE
    AND a.is_leave   = FALSE
    AND a.check_in_time  IS NOT NULL
  WHERE sa.client_id = p_client_id
    AND sa.status    = 'active'
  GROUP BY sa.id, sa.service_request_id, sa.hourly_rate, sr.hourly_rate;
$$;
