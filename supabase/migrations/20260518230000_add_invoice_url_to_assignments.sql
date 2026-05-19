-- Migration: Add invoice tracking columns to worker_assignments
-- Date: 2026-05-18

ALTER TABLE public.worker_assignments
ADD COLUMN IF NOT EXISTS deposit_invoice_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS invoice_pdf_url text;

COMMENT ON COLUMN public.worker_assignments.deposit_invoice_sent IS 'Flag indicating if the initial deposit invoice has been generated and sent to the client via WhatsApp.';
COMMENT ON COLUMN public.worker_assignments.invoice_pdf_url IS 'The public URL pointing to the generated invoice PDF stored in Supabase Storage.';
