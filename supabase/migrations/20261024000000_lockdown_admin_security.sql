-- Migration: Lockdown Admin Security & Audit Log Immutability
-- 1. Ensure audit logs are append-only and cannot be tampered with or deleted by public/anon requests
-- 2. Restrict deletion request table from arbitrary public deletion

-- Secure audit_logs table (Drop UPDATE and DELETE policies for public/anon)
DROP POLICY IF EXISTS "Allow public delete on audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow public update on audit_logs" ON public.audit_logs;

-- Recreate strict immutable audit logging:
-- Only service_role can delete or update audit records if maintenance is ever needed.
CREATE POLICY "Strict: audit_logs cannot be deleted publicly"
    ON public.audit_logs
    FOR DELETE
    TO service_role
    USING (true);

CREATE POLICY "Strict: audit_logs cannot be modified"
    ON public.audit_logs
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Secure deletion_requests table (Drop public DELETE)
DROP POLICY IF EXISTS "Allow public delete on deletion_requests" ON public.deletion_requests;

CREATE POLICY "Strict: deletion_requests deletion restricted to service_role"
    ON public.deletion_requests
    FOR DELETE
    TO service_role
    USING (true);
