-- Create trigger function to auto-release staff when a crm_lead is deleted
CREATE OR REPLACE FUNCTION public.handle_crm_lead_deleted()
RETURNS TRIGGER AS $$
DECLARE
    v_employee_ids UUID[];
BEGIN
    -- 1. Gather all employee IDs assigned to this lead
    SELECT ARRAY_AGG(employee_id)
    INTO v_employee_ids
    FROM public.worker_assignments
    WHERE client_id = OLD.id AND assignment_status = 'active';

    -- 2. Release those employees
    IF v_employee_ids IS NOT NULL AND array_length(v_employee_ids, 1) > 0 THEN
        UPDATE public.employees
        SET status = 'available',
            assigned_client = NULL,
            updated_at = NOW()
        WHERE id = ANY(v_employee_ids);
    END IF;

    -- Also update via name-matching in legacy workers table if name is present
    IF OLD.name IS NOT NULL THEN
        UPDATE public.employees
        SET status = 'available',
            assigned_client = NULL,
            updated_at = NOW()
        WHERE assigned_client = OLD.name;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers') THEN
            EXECUTE 'UPDATE public.workers SET status = ''Available'', assigned_client = NULL WHERE assigned_client = $1' USING OLD.name;
        END IF;
    END IF;

    -- 3. Deactivate any active ID card links
    UPDATE public.id_card_links
    SET is_active = false
    WHERE assignment_id IN (
        SELECT id 
        FROM public.worker_assignments 
        WHERE client_id = OLD.id
    );

    -- 4. Mark all assignments for this lead as cancelled
    UPDATE public.worker_assignments
    SET assignment_status = 'cancelled'
    WHERE client_id = OLD.id;

    -- 5. Delete from public.clients (which will cascade delete active assignments if foreign key constraints require it)
    DELETE FROM public.clients WHERE id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on crm_leads
DROP TRIGGER IF EXISTS trg_on_crm_lead_deleted ON public.crm_leads;
CREATE TRIGGER trg_on_crm_lead_deleted
    AFTER DELETE ON public.crm_leads
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_crm_lead_deleted();


-- ============================================================
-- DATABASE HEALING: Clean up any already orphaned assignments
-- ============================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT wa.id, wa.employee_id, wa.client_id
        FROM public.worker_assignments wa
        LEFT JOIN public.crm_leads cl ON wa.client_id = cl.id
        WHERE wa.assignment_status = 'active' AND cl.id IS NULL
    LOOP
        -- Revert worker status
        UPDATE public.employees 
        SET status = 'available', assigned_client = NULL 
        WHERE id = r.employee_id;

        -- Cancel assignment
        UPDATE public.worker_assignments 
        SET assignment_status = 'cancelled' 
        WHERE id = r.id;

        -- Deactivate ID cards
        UPDATE public.id_card_links 
        SET is_active = false 
        WHERE assignment_id = r.id;

        -- Delete orphaned client if it exists
        DELETE FROM public.clients WHERE id = r.client_id;
    END LOOP;
END;
$$;
