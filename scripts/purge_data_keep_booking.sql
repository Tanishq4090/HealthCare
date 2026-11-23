-- ==============================================================================
-- DATABASE CLEANUP SCRIPT: PURGE ALL CLIENTS & LEADS EXCEPT RECENT WEBSITE BOOKING
-- ==============================================================================
-- PRESERVED:
--   1. Recent Website Booking (Kajol Motiramani / 90338 57166)
--   2. All Caregivers & Staff (employees table remains 100% intact)
-- PURGED:
--   - All other clients, leads, deposits, payments, service records, and assignments.
--   - Caretaker payroll & salary records.
-- ==============================================================================

DO $$
DECLARE
    v_preserved_lead_id UUID;
    v_preserved_client_id UUID;
    v_preserved_phone TEXT;
    v_preserved_name TEXT;
    v_deleted_leads_count INT := 0;
    v_deleted_clients_count INT := 0;
    v_deleted_services_count INT := 0;
    v_deleted_payments_count INT := 0;
    v_deleted_assignments_count INT := 0;
    v_deleted_payroll_count INT := 0;
BEGIN
    -- 1. Identify the recent website booking to preserve
    SELECT id, name, COALESCE(phone, whatsapp_number)
    INTO v_preserved_lead_id, v_preserved_name, v_preserved_phone
    FROM public.crm_leads
    WHERE name ILIKE '%Kajol%' 
       OR phone ILIKE '%90338%57166%' 
       OR whatsapp_number ILIKE '%90338%57166%'
    ORDER BY created_at DESC 
    LIMIT 1;

    -- If no specific match by name, fall back to the most recent website booking
    IF v_preserved_lead_id IS NULL THEN
        SELECT id, name, COALESCE(phone, whatsapp_number)
        INTO v_preserved_lead_id, v_preserved_name, v_preserved_phone
        FROM public.crm_leads
        WHERE source ILIKE '%website%' OR pipeline_stage = 'Form Submitted'
        ORDER BY created_at DESC 
        LIMIT 1;
    END IF;

    RAISE NOTICE '>>> PRESERVING WEBSITE BOOKING: ID=%, Name=%, Phone=%', 
        v_preserved_lead_id, v_preserved_name, v_preserved_phone;

    -- Also check if a client record exists with this same ID or phone
    IF v_preserved_lead_id IS NOT NULL THEN
        SELECT id INTO v_preserved_client_id
        FROM public.clients
        WHERE id = v_preserved_lead_id 
           OR phone_number ILIKE '%' || RIGHT(REGEXP_REPLACE(COALESCE(v_preserved_phone, ''), '[^0-9]', '', 'g'), 10) || '%'
        LIMIT 1;
    END IF;

    -- 2. Release all caregivers in employees table (free them up to 'available')
    -- NOTE: Zero caregivers/staff are deleted! All caretaker records stay intact.
    UPDATE public.employees
    SET status = 'available',
        assigned_client = NULL,
        updated_at = NOW();

    -- Also update legacy workers table if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers') THEN
        UPDATE public.workers
        SET status = 'Available',
            assigned_client = NULL;
    END IF;

    -- 3. Clear caretaker payroll records
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll') THEN
        DELETE FROM public.payroll;
        GET DIAGNOSTICS v_deleted_payroll_count = ROW_COUNT;
    END IF;

    -- 4. Clear attendance & worker assignments
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance') THEN
        DELETE FROM public.attendance;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_worker_assignments') THEN
        DELETE FROM public.service_worker_assignments
        WHERE service_id IN (
            SELECT id FROM public.services 
            WHERE (v_preserved_lead_id IS NULL OR (lead_id != v_preserved_lead_id AND (client_id IS NULL OR client_id != v_preserved_lead_id)))
              AND (v_preserved_client_id IS NULL OR client_id != v_preserved_client_id)
        );
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'worker_assignments' AND table_name = 'worker_assignments') 
       OR EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'worker_assignments') THEN
        DELETE FROM public.worker_assignments
        WHERE (v_preserved_lead_id IS NULL OR client_id != v_preserved_lead_id)
          AND (v_preserved_client_id IS NULL OR client_id != v_preserved_client_id);
        GET DIAGNOSTICS v_deleted_assignments_count = ROW_COUNT;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'duty_logs') THEN
        DELETE FROM public.duty_logs
        WHERE (v_preserved_lead_id IS NULL OR client_id != v_preserved_lead_id)
          AND (v_preserved_client_id IS NULL OR client_id != v_preserved_client_id);
    END IF;

    -- 5. Clear financial deposits & payment records
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
        DELETE FROM public.payments
        WHERE v_preserved_name IS NULL OR client_name NOT ILIKE '%' || v_preserved_name || '%';
        GET DIAGNOSTICS v_deleted_payments_count = ROW_COUNT;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_bills') THEN
        DELETE FROM public.service_bills
        WHERE service_id IN (
            SELECT id FROM public.services 
            WHERE (v_preserved_lead_id IS NULL OR (lead_id != v_preserved_lead_id AND (client_id IS NULL OR client_id != v_preserved_lead_id)))
              AND (v_preserved_client_id IS NULL OR client_id != v_preserved_client_id)
        );
    END IF;

    -- 6. Clear services
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
        DELETE FROM public.services
        WHERE (v_preserved_client_id IS NULL OR client_id != v_preserved_client_id)
          AND (v_preserved_lead_id IS NULL OR (lead_id != v_preserved_lead_id AND (client_id IS NULL OR client_id != v_preserved_lead_id)));
        GET DIAGNOSTICS v_deleted_services_count = ROW_COUNT;
    END IF;

    -- 7. Clear client consents & work forms (these link strictly via lead_id)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_consents') THEN
        DELETE FROM public.client_consents
        WHERE v_preserved_lead_id IS NULL OR lead_id != v_preserved_lead_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_work_forms') THEN
        DELETE FROM public.client_work_forms
        WHERE v_preserved_lead_id IS NULL OR lead_id != v_preserved_lead_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_quotations') THEN
        DELETE FROM public.crm_quotations
        WHERE v_preserved_lead_id IS NULL OR lead_id != v_preserved_lead_id;
    END IF;

    -- 8. Clear interaction logs & activity
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_lead_activity') THEN
        DELETE FROM public.crm_lead_activity
        WHERE v_preserved_lead_id IS NULL OR lead_id != v_preserved_lead_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_activity_log') THEN
        DELETE FROM public.lead_activity_log
        WHERE v_preserved_lead_id IS NULL OR lead_id != v_preserved_lead_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_call_logs') THEN
        DELETE FROM public.crm_call_logs
        WHERE v_preserved_lead_id IS NULL OR lead_id != v_preserved_lead_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'call_transcripts') THEN
        DELETE FROM public.call_transcripts
        WHERE v_preserved_lead_id IS NULL OR lead_id != v_preserved_lead_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_messages') THEN
        DELETE FROM public.whatsapp_messages
        WHERE v_preserved_phone IS NULL OR phone NOT ILIKE '%' || RIGHT(REGEXP_REPLACE(v_preserved_phone, '[^0-9]', '', 'g'), 10) || '%';
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_logs') THEN
        DELETE FROM public.whatsapp_logs
        WHERE (v_preserved_phone IS NULL OR payload->>'original_recipient' NOT ILIKE '%' || RIGHT(REGEXP_REPLACE(v_preserved_phone, '[^0-9]', '', 'g'), 10) || '%')
          AND (v_preserved_lead_id IS NULL OR payload->>'leadId' != v_preserved_lead_id::TEXT);
    END IF;

    -- 9. Clear Client Master records (clients table)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
        DELETE FROM public.clients
        WHERE (v_preserved_client_id IS NULL OR id != v_preserved_client_id)
          AND (v_preserved_lead_id IS NULL OR id != v_preserved_lead_id);
        GET DIAGNOSTICS v_deleted_clients_count = ROW_COUNT;
    END IF;

    -- 10. Clear CRM Leads (crm_leads table)
    DELETE FROM public.crm_leads
    WHERE v_preserved_lead_id IS NULL OR id != v_preserved_lead_id;
    GET DIAGNOSTICS v_deleted_leads_count = ROW_COUNT;

    -- Also delete from legacy leads table if it exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
        DELETE FROM public.leads
        WHERE v_preserved_lead_id IS NULL OR id != v_preserved_lead_id;
    END IF;

    -- Output completion report
    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'DATABASE CLEANUP COMPLETE:';
    RAISE NOTICE ' - Leads deleted: %', v_deleted_leads_count;
    RAISE NOTICE ' - Clients deleted: %', v_deleted_clients_count;
    RAISE NOTICE ' - Services deleted: %', v_deleted_services_count;
    RAISE NOTICE ' - Worker assignments deleted: %', v_deleted_assignments_count;
    RAISE NOTICE ' - Payments & Deposits deleted: %', v_deleted_payments_count;
    RAISE NOTICE ' - Caretaker Payroll records deleted: %', v_deleted_payroll_count;
    RAISE NOTICE ' - Caregivers preserved: ALL (status set to available)';
    RAISE NOTICE ' - Preserved Booking: % (%)', v_preserved_name, v_preserved_lead_id;
    RAISE NOTICE '=========================================================';
END $$;
