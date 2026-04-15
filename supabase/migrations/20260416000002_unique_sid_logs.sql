-- Add unique constraint to sid in whatsapp_logs to prevent duplicate processing
ALTER TABLE whatsapp_logs ADD CONSTRAINT whatsapp_logs_sid_key UNIQUE (sid);
