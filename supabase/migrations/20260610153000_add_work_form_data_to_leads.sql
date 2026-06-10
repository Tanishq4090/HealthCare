-- Add a JSONB column directly on crm_leads to store work form data.
-- This is simpler and more reliable than a separate client_work_forms table
-- because it avoids PostgREST schema-cache issues and is always fetched with the lead.
ALTER TABLE public.crm_leads
    ADD COLUMN IF NOT EXISTS work_form_data JSONB;
