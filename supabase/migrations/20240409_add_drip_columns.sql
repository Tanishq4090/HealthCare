-- 20240409_add_drip_columns.sql
-- Add columns for no-response drip campaign
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS drip_step INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_greeted_at TIMESTAMPTZ;
