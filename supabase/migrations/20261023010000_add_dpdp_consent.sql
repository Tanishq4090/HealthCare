-- Migration: Add DPDP Act 2023 Consent & Retention Tracking
-- Supports Purpose-Specific Consent (Data Storage, Marketing, Review Messages)
-- Supports Retention Period Limitation (Section 8(7) of DPDP Act 2023)

-- 1. Add dpdp_consent JSONB column to client_consents
ALTER TABLE public.client_consents 
ADD COLUMN IF NOT EXISTS dpdp_consent JSONB DEFAULT NULL;

-- 2. Add dpdp_consent JSONB column to crm_leads
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS dpdp_consent JSONB DEFAULT NULL;

-- Add index on dpdp_consent for fast filtering on marketing/retention queries
CREATE INDEX IF NOT EXISTS idx_crm_leads_dpdp_consent ON public.crm_leads USING gin (dpdp_consent);
CREATE INDEX IF NOT EXISTS idx_client_consents_dpdp_consent ON public.client_consents USING gin (dpdp_consent);

COMMENT ON COLUMN public.crm_leads.dpdp_consent IS 'DPDP Act 2023 itemized consent for storage, marketing broadcasts, feedback reviews, and retention expiration';
COMMENT ON COLUMN public.client_consents.dpdp_consent IS 'DPDP Act 2023 consent record captured during client intake or WhatsApp verification flow';
