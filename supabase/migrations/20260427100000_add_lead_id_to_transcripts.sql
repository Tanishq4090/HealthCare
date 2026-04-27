-- Add lead_id to call_transcripts so we can track which calls were converted to leads
-- This powers the "Added to CRM" badge in the AI auto-tracking dashboard

ALTER TABLE IF EXISTS call_transcripts 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL;
