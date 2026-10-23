-- Migration: Create audit_logs table for tracking user actions on client data
-- Date: 2026-10-23
-- Purpose: Records who viewed, edited, exported, or deleted client data, including device, OS, browser, IP, and field diffs.

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL DEFAULT 'client', -- 'client', 'lead', 'worker', 'finance'
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    action TEXT NOT NULL, -- 'VIEW', 'EDIT', 'EXPORT', 'SERVICE_CHANGE', 'DELETE', 'CREATE'
    description TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL DEFAULT 'staff',
    device_info JSONB DEFAULT '{}'::jsonb,
    changes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for lightning-fast filtering in Admin panel
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Allow public read on audit_logs'
    ) THEN
        CREATE POLICY "Allow public read on audit_logs" ON public.audit_logs FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Allow public insert on audit_logs'
    ) THEN
        CREATE POLICY "Allow public insert on audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Allow public update on audit_logs'
    ) THEN
        CREATE POLICY "Allow public update on audit_logs" ON public.audit_logs FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'audit_logs' AND policyname = 'Allow public delete on audit_logs'
    ) THEN
        CREATE POLICY "Allow public delete on audit_logs" ON public.audit_logs FOR DELETE USING (true);
    END IF;
END $$;

COMMENT ON TABLE public.audit_logs IS 'System audit trail tracking views, edits, exports, and deletions of sensitive client data including device and IP context.';
