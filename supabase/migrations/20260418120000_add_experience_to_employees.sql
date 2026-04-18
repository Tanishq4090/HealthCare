-- Add experience column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS experience TEXT;

-- Comment for documentation
COMMENT ON COLUMN employees.experience IS 'Years/description of work experience, e.g. "5 Years", "3+ Years in Elderly Care"';
