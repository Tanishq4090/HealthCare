-- Add greeting idempotency columns to crm_leads
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS greeting_sent BOOLEAN DEFAULT false;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS greeting_sent_at TIMESTAMPTZ;

-- Backfill: Mark leads that already have last_greeted_at as greeting_sent = true
UPDATE crm_leads 
SET greeting_sent = true, greeting_sent_at = last_greeted_at 
WHERE last_greeted_at IS NOT NULL AND (greeting_sent IS NULL OR greeting_sent = false);

-- Atomic claim function: Returns the lead row ONLY if the greeting was not yet sent.
-- If another process already claimed it, returns 0 rows.
-- This prevents race conditions between auto-trigger and manual click.
CREATE OR REPLACE FUNCTION claim_greeting_send(target_lead_id UUID)
RETURNS TABLE(id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE crm_leads
  SET greeting_sent = true, greeting_sent_at = NOW()
  WHERE crm_leads.id = target_lead_id
    AND (crm_leads.greeting_sent IS NULL OR crm_leads.greeting_sent = false)
  RETURNING crm_leads.id;
END;
$$;

-- Allow anon and authenticated roles to call the RPC
GRANT EXECUTE ON FUNCTION claim_greeting_send(UUID) TO anon;
GRANT EXECUTE ON FUNCTION claim_greeting_send(UUID) TO authenticated;

-- Remove drip campaign columns (no longer needed)
-- Note: keeping last_greeted_at as it's used for audit purposes
ALTER TABLE crm_leads DROP COLUMN IF EXISTS drip_step;

-- Remove drip campaign cron job if it exists
SELECT cron.unschedule('drip-campaign-cron') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drip-campaign-cron'
);
