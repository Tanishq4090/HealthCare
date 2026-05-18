-- Create public invoices bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Allow service role to upload
CREATE POLICY "Service role can upload invoices"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'invoices');

-- Allow public read
CREATE POLICY "Public can read invoices"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoices');
