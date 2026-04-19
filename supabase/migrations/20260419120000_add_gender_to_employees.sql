-- Add gender column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT;

-- Comment for documentation
COMMENT ON COLUMN employees.gender IS 'Employee gender (e.g., Male, Female, Other)';
