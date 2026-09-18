-- Create deletion_requests table
CREATE TABLE IF NOT EXISTS public.deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'client', 'lead', 'worker', 'attendance'
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    action_type TEXT NOT NULL DEFAULT 'permanent_delete', -- 'move_to_trash', 'permanent_delete'
    reason TEXT,
    requested_by_id TEXT NOT NULL,
    requested_by_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Policies for public / authenticated access in 99Care OS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'deletion_requests' AND policyname = 'Allow public read on deletion_requests'
    ) THEN
        CREATE POLICY "Allow public read on deletion_requests" ON public.deletion_requests FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'deletion_requests' AND policyname = 'Allow public insert on deletion_requests'
    ) THEN
        CREATE POLICY "Allow public insert on deletion_requests" ON public.deletion_requests FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'deletion_requests' AND policyname = 'Allow public update on deletion_requests'
    ) THEN
        CREATE POLICY "Allow public update on deletion_requests" ON public.deletion_requests FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'deletion_requests' AND policyname = 'Allow public delete on deletion_requests'
    ) THEN
        CREATE POLICY "Allow public delete on deletion_requests" ON public.deletion_requests FOR DELETE USING (true);
    END IF;
END $$;
