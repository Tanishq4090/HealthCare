-- ============================================================
-- Migration: Robust CRM Lead Deletion (RPC)
-- Purpose: Bypasses RLS and cascades deletions across all linked tables
--          to ensure leads don't "pop back up" after deletion.
-- Date: 2026-04-17
-- ============================================================

CREATE OR REPLACE FUNCTION delete_crm_lead_robust(target_lead_id UUID)
RETURNS VOID AS $$
DECLARE
    v_lead_name TEXT;
    v_employee_ids UUID[];
BEGIN
    -- 0. Get the lead name for legacy cleanup
    SELECT name INTO v_lead_name FROM public.crm_leads WHERE id = target_lead_id;

    -- 1. Identify all employees currently assigned to this lead
    -- We look into worker_assignments which references clients(id)
    -- In this system, clients and crm_leads share the same UUID for the same entity.
    SELECT ARRAY_AGG(employee_id) INTO v_employee_ids
    FROM public.worker_assignments
    WHERE client_id = target_lead_id;

    -- 2. Release Employees (mark as available)
    IF v_employee_ids IS NOT NULL THEN
        UPDATE public.employees
        SET status = 'available',
            assigned_client = NULL,
            updated_at = NOW()
        WHERE id = ANY(v_employee_ids);
    END IF;

    -- 3. Legacy cleanup (update 'workers' table if it exists)
    -- This is for backwards compatibility with the old workers management
    UPDATE public.workers
    SET assigned_client = NULL,
        status = 'Available'
    WHERE assigned_client = v_lead_name;

    -- 4. Delete from child tables with explicit references
    -- Note: Most of these have ON DELETE CASCADE from 'clients', 
    -- but we perform explicit cleanup for maximum robustness.
    
    -- Delete call logs linked to this lead
    -- (Migration 20260326000000 has ON DELETE SET NULL, 
    -- but for a 'Deep Delete' we might want to actually remove them or keep them as orphans.
    -- The user wants the lead GONE and persistent, so we keep logs as orphans (lead_id becomes null).
    -- If we wanted to delete logs, we would do it here. We'll stick to the current schema's SET NULL behavior.)

    -- 5. Delete from public.clients
    -- This triggers ON DELETE CASCADE for:
    -- - worker_assignments
    -- - id_card_links
    DELETE FROM public.clients WHERE id = target_lead_id;

    -- 6. Finally, delete the lead record itself
    DELETE FROM public.crm_leads WHERE id = target_lead_id;

    -- 7. (Optional) Cleanup legacy 'leads' table if ID matches
    DELETE FROM public.leads WHERE id = target_lead_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users (admin dashboard)
GRANT EXECUTE ON FUNCTION delete_crm_lead_robust(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_crm_lead_robust(UUID) TO service_role;
