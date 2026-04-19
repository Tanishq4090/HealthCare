-- ============================================================
-- Migration: Project-Wide CRM Persistence & Deep Deletion (V3.1)
-- Purpose: Fixes the 42P13 error and ensures all CRM changes are 
--          100% persistent and unblocked by RLS.
-- Date: 2026-04-18
-- ============================================================

-- 1. DROP the old version to allow changing the return type (Fixes 42P13)
DROP FUNCTION IF EXISTS public.delete_crm_lead_robust(uuid);

-- 2. CREATE the robust multi-table deletion function (V4.1 - Hyper-Resilient)
CREATE OR REPLACE FUNCTION public.delete_crm_lead_robust(target_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_lead_name TEXT;
    v_lead_phone TEXT;
    v_lead_whatsapp TEXT;
    v_phone_trim TEXT;
    v_employee_ids UUID[];
    v_table_exists BOOLEAN;
BEGIN
    -- 0. Gather lead info (BEFORE DELETION)
    SELECT name, phone, whatsapp_number 
    INTO v_lead_name, v_lead_phone, v_lead_whatsapp 
    FROM public.crm_leads WHERE id = target_lead_id;

    -- Calculate normalized phone for history purge (Last 10 digits)
    v_phone_trim := RIGHT(REGEXP_REPLACE(COALESCE(v_lead_phone, v_lead_whatsapp, ''), '[^0-9]', '', 'g'), 10);

    -- 1. Identify and release employees
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'worker_assignments') INTO v_table_exists;
    IF v_table_exists THEN
        EXECUTE 'SELECT ARRAY_AGG(employee_id) FROM public.worker_assignments WHERE client_id = $1' 
        USING target_lead_id INTO v_employee_ids;

        IF v_employee_ids IS NOT NULL AND (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees')) THEN
            EXECUTE 'UPDATE public.employees SET status = ''available'', assigned_client = NULL, updated_at = NOW() WHERE id = ANY($1)' 
            USING v_employee_ids;
        END IF;
    END IF;

    -- 2. HISTORY PURGE (Safe Checks)
    IF v_phone_trim IS NOT NULL AND v_phone_trim <> '' THEN
        -- whatsapp_messages
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_messages') THEN
            EXECUTE 'DELETE FROM public.whatsapp_messages WHERE phone ILIKE ''%'' || $1 || ''%''' USING v_phone_trim;
        END IF;
        
        -- crm_call_logs
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_call_logs') THEN
            EXECUTE 'DELETE FROM public.crm_call_logs WHERE phone_number ILIKE ''%'' || $1 || ''%'' OR lead_id = $2' USING v_phone_trim, target_lead_id;
        END IF;
        
        -- call_transcripts
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'call_transcripts') THEN
            EXECUTE 'DELETE FROM public.call_transcripts WHERE phone_number ILIKE ''%'' || $1 || ''%''' USING v_phone_trim;
        END IF;
        
        -- whatsapp_logs
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_logs') THEN
            EXECUTE 'DELETE FROM public.whatsapp_logs WHERE payload->>''original_recipient'' ILIKE ''%'' || $1 || ''%'' OR payload->>''leadId'' = $2::TEXT' USING v_phone_trim, target_lead_id;
        END IF;
    END IF;

    -- 3. Clean up additional dependencies (Safe Checks)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'duty_logs') THEN
        EXECUTE 'DELETE FROM public.duty_logs WHERE client_id = $1' USING target_lead_id;
    END IF;
    
    IF v_lead_name IS NOT NULL AND (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers')) THEN
        EXECUTE 'UPDATE public.workers SET assigned_client = NULL, status = ''Available'' WHERE assigned_client = $1' USING v_lead_name;
    END IF;

    -- 4. Delete from Clients
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
        EXECUTE 'DELETE FROM public.clients WHERE id = $1' USING target_lead_id;
    END IF;

    -- 5. Delete Lead records
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
        EXECUTE 'DELETE FROM public.leads WHERE id = $1' USING target_lead_id;
    END IF;
    DELETE FROM public.crm_leads WHERE id = target_lead_id;

    RETURN jsonb_build_object('success', true, 'lead_id', target_lead_id, 'phone_purged', v_phone_trim);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure Permissive RLS Policies for Persistence
-- This ensures 'authenticated' dashboard users are never blocked from updating/deleting leads.
DROP POLICY IF EXISTS "Authenticated users: full CRM access" ON public.crm_leads;
CREATE POLICY "Authenticated users: full CRM access" 
    ON public.crm_leads FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Only handle legacy leads policy if the table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Authenticated users: full legacy leads access" ON public.leads';
        EXECUTE 'CREATE POLICY "Authenticated users: full legacy leads access" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- 4. Permissions
GRANT EXECUTE ON FUNCTION public.delete_crm_lead_robust(UUID) TO authenticated, service_role;
