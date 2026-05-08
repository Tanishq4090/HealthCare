-- Migration: Add quoted rates to crm_leads for intelligent billing estimation
-- Date: 2026-05-09

ALTER TABLE public.crm_leads
ADD COLUMN IF NOT EXISTS quoted_monthly_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS quoted_daily_rate numeric DEFAULT 0;

COMMENT ON COLUMN public.crm_leads.quoted_monthly_rate IS 'Quoted rate for a full month service.';
COMMENT ON COLUMN public.crm_leads.quoted_daily_rate IS 'Quoted per-day rate for incomplete months or short-term service.';
