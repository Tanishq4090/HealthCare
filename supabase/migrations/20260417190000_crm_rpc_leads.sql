-- ============================================================
-- Migration: CRM Foolproof Worker Fetch (RPC)
-- Purpose: Join leads and workers server-side to bypass RLS issues
-- Date: 2026-04-17
-- ============================================================

CREATE OR REPLACE FUNCTION get_crm_leads_with_workers()
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    pipeline_stage TEXT,
    created_at TIMESTAMPTZ,
    assigned_worker_name TEXT,
    assigned_worker_role TEXT,
    full_lead_data JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        l.phone,
        l.pipeline_stage,
        l.created_at,
        e.full_name as assigned_worker_name,
        e.job_title as assigned_worker_role,
        to_jsonb(l.*) || jsonb_build_object(
            'assigned_worker_name', e.full_name,
            'assigned_worker_role', e.job_title
        ) as full_lead_data
    FROM crm_leads l
    LEFT JOIN worker_assignments wa ON wa.client_id = l.id AND wa.assignment_status = 'active'
    LEFT JOIN employees e ON e.id = wa.employee_id
    ORDER BY l.created_at DESC;
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_crm_leads_with_workers() TO anon, authenticated, service_role;
