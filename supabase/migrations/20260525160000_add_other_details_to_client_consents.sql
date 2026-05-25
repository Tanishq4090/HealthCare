ALTER TABLE public.client_consents
ADD COLUMN IF NOT EXISTS other_details TEXT;
