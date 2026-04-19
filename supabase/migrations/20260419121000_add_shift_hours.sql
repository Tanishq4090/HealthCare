-- Add shift_hours column to employees table to track the standard duration of hourly shifts
ALTER TABLE employees ADD COLUMN IF NOT EXISTS shift_hours NUMERIC;

-- Comment for documentation
COMMENT ON COLUMN employees.shift_hours IS 'Standard shift duration in hours for hourly employees (e.g. 8, 10, 24)';
