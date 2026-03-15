-- ============================================================
-- 99 Care CRM — Migration 004
-- 1. Snapshot hourly_rate into attendance rows on check-in
--    so historical billing can't drift when rates change
-- 2. Auto-close shifts forgotten overnight (cron at midnight)
-- Run after 003_hourly_billing.sql
-- ============================================================

-- ── 1. Add hourly_rate snapshot to attendance ─────────────────

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS hourly_rate_snapshot NUMERIC(8,2);

-- Trigger: when a check-in is inserted, copy the current rate
-- from staff_assignments into the row immediately.
-- This locks in the rate at the moment work started.

CREATE OR REPLACE FUNCTION snapshot_hourly_rate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_rate NUMERIC(8,2);
BEGIN
  -- Only run on check-in (when check_in is being set for the first time)
  IF NEW.check_in_time IS NULL THEN RETURN NEW; END IF;
IF OLD IS NOT NULL AND OLD.check_in_time IS NOT NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(sa.hourly_rate, sr.hourly_rate)
  INTO   v_rate
  FROM   staff_assignments sa
  JOIN   service_requests  sr ON sr.id = sa.service_request_id
  WHERE  sa.id = NEW.assignment_id;

  NEW.hourly_rate_snapshot := v_rate;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_rate
  BEFORE INSERT OR UPDATE OF check_in_time ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION snapshot_hourly_rate();

-- ── Update calculate_monthly_bill to use snapshot rate ────────
-- Prefer the snapshotted rate on each row; fall back to
-- assignment rate only for rows that predate migration 004.

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
    -- Each hour billed at the rate that was active when work happened
    COALESCE(
      SUM(
        a.hours_worked *
        COALESCE(a.hourly_rate_snapshot, sa.hourly_rate, sr.hourly_rate, 0)
      ), 0
    )                                                 AS gross_amount
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

-- ── 2. Auto-close forgotten shifts ────────────────────────────
-- Runs at midnight via pg_cron.
-- Any shift with check_in_time but no check_out_time from a previous day
-- gets auto-closed at check_in_time + 10 hours (capped at 23:59).
-- HR can correct manually via admin UI.

CREATE OR REPLACE FUNCTION auto_close_forgotten_shifts()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec   RECORD;
  v_checkout TIMESTAMPTZ;
  v_hours    NUMERIC;
BEGIN
  FOR v_rec IN
    SELECT a.id, a.check_in_time, a.assignment_id
    FROM   attendance a
    WHERE  a.check_in  IS NOT NULL
      AND  a.check_out_time IS NULL
      AND  a.is_absent  = FALSE
      AND  a.duty_date  < CURRENT_DATE   -- yesterday or older only
  LOOP
    -- Cap at check_in + 10 hours, but never past 23:59 of that day
    -- Close at midnight of the duty day, not check_in + 10h
    -- (avoids crossing billing days for evening check-ins)
    v_checkout := DATE_TRUNC('day', v_rec.check_in_time) + INTERVAL '23 hours 59 minutes';
    v_hours := EXTRACT(EPOCH FROM (v_checkout - v_rec.check_in)) / 3600.0;

    UPDATE attendance
    SET check_out_time = v_checkout,
           hours_worked  = ROUND(v_hours::NUMERIC, 2),
           notes         = COALESCE(notes || ' | ', '') || 'Auto-closed by system (shift not ended)'
    WHERE  id = v_rec.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Schedule: run at midnight every day
-- Enable pg_cron in Supabase Dashboard → Database → Extensions first
SELECT cron.schedule(
  'auto-close-shifts',
  '0 0 * * *',
  $$ SELECT auto_close_forgotten_shifts(); $$
);

-- Also schedule monthly billing trigger on 1st of each month at 9am
SELECT cron.schedule(
  'monthly-billing',
  '0 9 1 * *',
  $$
    UPDATE leads
    SET    status = 'monthly_billing'
    WHERE  converted_client_id IN (SELECT id FROM clients WHERE status = 'active')
      AND  status = 'active';
  $$
);
