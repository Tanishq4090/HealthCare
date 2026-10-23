-- Migration: Add phone_numbers and phone to staff_users and automation_settings
-- Enables multi-phone registration and 2FA destination selection during login

ALTER TABLE public.staff_users 
ADD COLUMN IF NOT EXISTS phone_numbers TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.staff_users.phone_numbers IS 'Array of verified phone numbers for 2FA OTP verification and SMS alerts.';
COMMENT ON COLUMN public.staff_users.phone IS 'Primary phone number for staff account.';

-- Add admin_phone_numbers to automation_settings for root admin
ALTER TABLE public.automation_settings
ADD COLUMN IF NOT EXISTS admin_phone_numbers JSONB DEFAULT '["+919016116564"]'::jsonb;

-- Initialize global row if missing
INSERT INTO public.automation_settings (id, admin_phone_numbers)
VALUES ('global', '["+919016116564"]'::jsonb)
ON CONFLICT (id) DO UPDATE
SET admin_phone_numbers = COALESCE(public.automation_settings.admin_phone_numbers, '["+919016116564"]'::jsonb);
