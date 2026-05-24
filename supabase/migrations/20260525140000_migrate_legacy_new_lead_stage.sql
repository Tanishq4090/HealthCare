-- Move invisible legacy pipeline stages into the current first column stage
UPDATE public.crm_leads
SET pipeline_stage = 'New Inquiry'
WHERE pipeline_stage IN ('New Lead', 'New');
