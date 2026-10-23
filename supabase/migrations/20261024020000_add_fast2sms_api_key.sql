-- Migration: Add fast2sms_api_key to automation_settings
-- Enables direct cellular SMS OTP delivery to mobile Messages app

ALTER TABLE public.automation_settings
ADD COLUMN IF NOT EXISTS fast2sms_api_key TEXT,
ADD COLUMN IF NOT EXISTS sms_channel_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.automation_settings.fast2sms_api_key IS 'Fast2SMS authorization API key for direct SMS OTP delivery to phone Messages app.';
COMMENT ON COLUMN public.automation_settings.sms_channel_enabled IS 'Controls whether direct SMS OTP delivery via Fast2SMS is active.';
