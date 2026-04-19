-- Update payroll table with new columns for better separation and tracking
ALTER TABLE payroll 
ADD COLUMN IF NOT EXISTS payroll_type TEXT DEFAULT 'both',
ADD COLUMN IF NOT EXISTS service_month TEXT,
ADD COLUMN IF NOT EXISTS advance_amount NUMERIC DEFAULT 0;

-- Update existing records to have a default type
UPDATE payroll SET payroll_type = 'both' WHERE payroll_type IS NULL;
