-- Add worker_phone to payroll
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS worker_phone TEXT;

-- Create payslips storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payslips', 'payslips', true, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Set up policies for the payslips bucket
CREATE POLICY "Payslips are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'payslips');

CREATE POLICY "Authenticated users can upload payslips" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'payslips');

CREATE POLICY "Authenticated users can update payslips" 
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payslips');
