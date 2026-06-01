-- Add an explicit daily payment type for workers.
-- The old add-worker form saved "Daily Rate" as "monthly", while true fixed monthly
-- workers were stored through other values. Convert those legacy rows to daily.

ALTER TABLE public.employees
  ALTER COLUMN preferred_payment_type SET DEFAULT 'daily';

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname
    INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.employees'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%preferred_payment_type%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.employees DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

UPDATE public.employees
SET preferred_payment_type = 'daily'
WHERE preferred_payment_type = 'monthly';

ALTER TABLE public.employees
  ADD CONSTRAINT employees_preferred_payment_type_check
  CHECK (preferred_payment_type IN ('hourly', 'daily', 'monthly', 'short_term'));

COMMENT ON COLUMN public.employees.preferred_payment_type IS
  'Tracks how the worker is typically paid: hourly, daily, fixed monthly, or per service.';
