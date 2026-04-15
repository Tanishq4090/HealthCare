ALTER TABLE automation_settings ADD COLUMN IF NOT EXISTS client_stages JSONB DEFAULT '["Active Client", "Monthly Billing", "Closed Won"]'::jsonb;
