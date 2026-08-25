-- ============================================================
-- Migration: Shift-Based Worker Salary Rates
-- Replaces monthly_daily_rate / preferred_payment_type / hourly_rate
-- / short_term_daily_rate with two clean columns:
--   rate_10hr  — salary per day for a 10-hour shift
--   rate_24hr  — salary per day for a 24-hour shift
-- Standard rates:
--   Male:   10hr → ₹600, 24hr → ₹800
--   Female: 10hr → ₹500, 24hr → ₹800
-- ============================================================

-- 1. Add new columns
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS rate_10hr NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_24hr NUMERIC DEFAULT 0;

-- 2. Populate from gender (standard rates)
UPDATE public.employees
  SET rate_10hr = CASE WHEN LOWER(gender) = 'female' THEN 500 ELSE 600 END,
      rate_24hr = 800;

-- 3. Drop old rate/scheme columns (no longer needed)
ALTER TABLE public.employees
  DROP COLUMN IF EXISTS monthly_daily_rate,
  DROP COLUMN IF EXISTS short_term_daily_rate,
  DROP COLUMN IF EXISTS hourly_rate,
  DROP COLUMN IF EXISTS preferred_payment_type,
  DROP COLUMN IF EXISTS shift_hours;

-- 4. Fix Kabita Pariyar duplicate — soft-delete the older active record
UPDATE public.employees
  SET deleted_at = NOW()
  WHERE id = '5cc156d6-a5ec-4104-8f82-835fc60390d6'; -- older created_at of the two active records

COMMENT ON COLUMN public.employees.rate_10hr IS 'Daily salary for a 10-hour shift. Male default ₹600, Female default ₹500.';
COMMENT ON COLUMN public.employees.rate_24hr IS 'Daily salary for a 24-hour shift. Default ₹800 for all.';
