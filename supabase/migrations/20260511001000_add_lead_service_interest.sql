-- Migration: Add service_interest and email fields to crm_leads
-- Date: 2026-05-11

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS service_interest TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.crm_leads.service_interest IS 'Type of care/service the lead is interested in. Populated from WhatsApp intake form or call transcript.';
COMMENT ON COLUMN public.crm_leads.email IS 'Email address of the lead. Can be entered manually.';
