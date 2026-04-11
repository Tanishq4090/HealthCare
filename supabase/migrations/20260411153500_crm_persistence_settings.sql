-- Migration to enable Cloud Persistence for CRM Settings
ALTER TABLE automation_settings 
ADD COLUMN IF NOT EXISTS pipeline_stages JSONB,
ADD COLUMN IF NOT EXISTS whatsapp_templates JSONB;

-- Initialize defaults for the global singleton row
UPDATE automation_settings 
SET 
  pipeline_stages = '["New Lead", "New Inquiry", "In Discussion", "Quotation Sent", "Form Submitted", "Staff Assigned", "Deposit Pending", "Active Client", "Monthly Billing", "Closed Won"]'::jsonb
WHERE id = 'global' AND pipeline_stages IS NULL;
