-- Do not purge WhatsApp chat history by phone when deleting a lead.
-- whatsapp_messages are never deleted by lead deletion.
-- whatsapp_logs are only removed when explicitly tied to the deleted lead id.
CREATE OR REPLACE FUNCTION public.delete_crm_lead_robust(target_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_lead_name TEXT;
    v_lead_phone TEXT;
    v_lead_whatsapp TEXT;
    v_phone_trim TEXT;
    v_employee_ids UUID[];
    v_table_exists BOOLEAN;
    v_duplicate_count INTEGER := 0;
BEGIN
    SELECT name, phone, whatsapp_number
    INTO v_lead_name, v_lead_phone, v_lead_whatsapp
    FROM public.crm_leads WHERE id = target_lead_id;

    v_phone_trim := RIGHT(REGEXP_REPLACE(COALESCE(v_lead_phone, v_lead_whatsapp, ''), '[^0-9]', '', 'g'), 10);

    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'worker_assignments') INTO v_table_exists;
    IF v_table_exists THEN
        EXECUTE 'SELECT ARRAY_AGG(employee_id) FROM public.worker_assignments WHERE client_id = $1'
        USING target_lead_id INTO v_employee_ids;

        IF v_employee_ids IS NOT NULL AND array_length(v_employee_ids, 1) > 0 AND (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees')) THEN
            EXECUTE 'UPDATE public.employees SET status = ''available'', assigned_client = NULL, updated_at = NOW() WHERE id = ANY($1)'
            USING v_employee_ids;
        END IF;
    END IF;

    IF v_phone_trim IS NOT NULL AND v_phone_trim <> '' THEN
        SELECT COUNT(*) INTO v_duplicate_count
        FROM public.crm_leads
        WHERE (RIGHT(REGEXP_REPLACE(COALESCE(phone, whatsapp_number, ''), '[^0-9]', '', 'g'), 10) = v_phone_trim)
        AND id != target_lead_id;
    END IF;

    -- History purge (non-WhatsApp only; never delete shared chat by phone)
    IF v_phone_trim IS NOT NULL AND v_phone_trim <> '' AND v_duplicate_count = 0 THEN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_call_logs') THEN
            EXECUTE 'DELETE FROM public.crm_call_logs WHERE phone_number ILIKE ''%'' || $1 || ''%'' OR lead_id = $2' USING v_phone_trim, target_lead_id;
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'call_transcripts') THEN
            EXECUTE 'DELETE FROM public.call_transcripts WHERE phone_number ILIKE ''%'' || $1 || ''%''' USING v_phone_trim;
        END IF;

        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_consents') THEN
            EXECUTE 'DELETE FROM public.client_consents WHERE phone ILIKE ''%'' || $1 || ''%'' OR lead_id = $2' USING v_phone_trim, target_lead_id;
        END IF;
    END IF;

    -- Lead-scoped WhatsApp logs only (preserve messages and phone-wide log history)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_logs') THEN
        EXECUTE 'DELETE FROM public.whatsapp_logs WHERE payload->>''leadId'' = $1::TEXT' USING target_lead_id;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'duty_logs') THEN
        EXECUTE 'DELETE FROM public.duty_logs WHERE client_id = $1' USING target_lead_id;
    END IF;

    IF v_lead_name IS NOT NULL AND (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees')) THEN
        EXECUTE 'UPDATE public.employees SET assigned_client = NULL, status = ''available'' WHERE assigned_client = $1' USING v_lead_name;
    END IF;
    IF v_lead_name IS NOT NULL AND (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workers')) THEN
        EXECUTE 'UPDATE public.workers SET assigned_client = NULL, status = ''Available'' WHERE assigned_client = $1' USING v_lead_name;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
        EXECUTE 'DELETE FROM public.clients WHERE id = $1' USING target_lead_id;
        -- Remove orphan client rows on the same phone (e.g. deleted leads like "Mark")
        IF v_phone_trim IS NOT NULL AND v_phone_trim <> '' THEN
            EXECUTE $q$
                DELETE FROM public.clients c
                WHERE RIGHT(REGEXP_REPLACE(COALESCE(c.phone_number, ''), '[^0-9]', '', 'g'), 10) = $1
                AND NOT EXISTS (
                    SELECT 1 FROM public.crm_leads l
                    WHERE l.id = c.id AND l.id != $2
                )
            $q$ USING v_phone_trim, target_lead_id;
        END IF;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
        EXECUTE 'DELETE FROM public.leads WHERE id = $1' USING target_lead_id;
    END IF;
    DELETE FROM public.crm_leads WHERE id = target_lead_id;

    RETURN jsonb_build_object('success', true, 'lead_id', target_lead_id, 'phone_purged', (v_duplicate_count = 0));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
