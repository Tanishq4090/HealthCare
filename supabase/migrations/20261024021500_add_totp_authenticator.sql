-- Migration: Add TOTP secret columns for Google Authenticator 2FA (100% Free)
-- Supports RFC 6238 Time-Based One-Time Password via Google Authenticator, Microsoft Authenticator, Apple Passwords

ALTER TABLE public.automation_settings
ADD COLUMN IF NOT EXISTS admin_totp_secret TEXT;

ALTER TABLE public.staff_users
ADD COLUMN IF NOT EXISTS totp_secret TEXT;

COMMENT ON COLUMN public.automation_settings.admin_totp_secret IS 'RFC 6238 Base32 secret for root admin Google Authenticator 2FA.';
COMMENT ON COLUMN public.staff_users.totp_secret IS 'RFC 6238 Base32 secret for staff admin Google Authenticator 2FA.';
