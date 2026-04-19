-- Add automation_error column to crm_call_logs
ALTER TABLE public.crm_call_logs
ADD COLUMN IF NOT EXISTS automation_error TEXT;

-- Add automation_error column to call_transcripts as well
ALTER TABLE public.call_transcripts
ADD COLUMN IF NOT EXISTS automation_error TEXT;
