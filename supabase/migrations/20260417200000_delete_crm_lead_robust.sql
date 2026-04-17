-- ============================================================
-- Migration: Project-Wide CRM Persistence & Deep Deletion (V3.1)
-- Purpose: Fixes the 42P13 error and ensures all CRM changes are 
--          100% persistent and unblocked by RLS.
-- Date: 2026-04-18
-- ============================================================

-- 1. DROP the old version to allow changing the return type (Fixes 42P13)
DROP FUNCTION IF EXISTS public.delete_crm_lead_robust(uuid);

-- 2. CREATE the robust multi-table deletion function
CREATE OR REPLACE FUNCTION public.delete_crm_lead_robust(target_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_lead_name TEXT;
    v_employee_ids UUID[];
BEGIN
    -- 0. Gather lead info
    SELECT name INTO v_lead_name FROM public.crm_leads WHERE id = target_lead_id;

    -- 1. Identify and release employees
    SELECT ARRAY_AGG(employee_id) INTO v_employee_ids
    FROM public.worker_assignments
    WHERE client_id = target_lead_id;

    IF v_employee_ids IS NOT NULL THEN
        UPDATE public.employees
        SET status = 'available',
            assigned_client = NULL,
            updated_at = NOW()
        WHERE id = ANY(v_employee_ids);
    END IF;

    -- 2. Clean up dependencies that BLOCK deletion
    -- Delete duty logs linked to this client
    DELETE FROM public.duty_logs WHERE client_id = target_lead_id;
    
    -- Update legacy workers matching by name
    IF v_lead_name IS NOT NULL THEN
        UPDATE public.workers
        SET assigned_client = NULL, status = 'Available'
        WHERE assigned_client = v_lead_name;
    END IF;

    -- 3. Delete from public.clients (Cascades to assignments, id_card_links)
    DELETE FROM public.clients WHERE id = target_lead_id;

    -- 4. Delete the Lead record from both modern and legacy tables
    DELETE FROM public.leads WHERE id = target_lead_id;
    DELETE FROM public.crm_leads WHERE id = target_lead_id;

    RETURN jsonb_build_object('success', true, 'lead_id', target_lead_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure Permissive RLS Policies for Persistence
-- This ensures 'authenticated' dashboard users are never blocked from updating/deleting leads.
DROP POLICY IF EXISTS "Authenticated users can manage crm_leads" ON public.crm_leads;
CREATE POLICY "Authenticated users: full CRM access" 
    ON public.crm_leads FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage leads" ON public.leads;
CREATE POLICY "Authenticated users: full legacy leads access" 
    ON public.leads FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 4. Permissions
GRANT EXECUTE ON FUNCTION public.delete_crm_lead_robust(UUID) TO authenticated, service_role;
