-- ============================================================
-- Migration: Add activity logging to appointment trigger
-- Purpose: Ensures a notification appears in the CRM Needs Attention dashboard
-- Date: 2026-05-29
-- ============================================================

CREATE OR REPLACE FUNCTION public.appointment_to_crm_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_lead_id UUID;
    service_label TEXT;
    appointment_notes TEXT;
    parsed_appointment_datetime TIMESTAMPTZ;
BEGIN
    -- Human-readable service label for CRM display
    service_label := initcap(replace(NEW.service, '-', ' '));

    -- Build notes field
    appointment_notes := 'Service: ' || service_label
        || E'\nDate: ' || to_char(NEW.preferred_date, 'DD Mon YYYY') || ' at ' || NEW.preferred_time
        || E'\nLocation: ' || NEW.location
        || CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> '' THEN E'\nPatient Notes: ' || NEW.notes ELSE '' END
        || CASE WHEN NEW.email IS NOT NULL AND NEW.email <> '' THEN E'\nEmail: ' || NEW.email ELSE '' END;
        
    -- Parse preferred_date and preferred_time into a timestamp
    BEGIN
        parsed_appointment_datetime := (NEW.preferred_date::text || ' ' || NEW.preferred_time)::timestamp AT TIME ZONE 'Asia/Kolkata';
    EXCEPTION WHEN OTHERS THEN
        parsed_appointment_datetime := NULL;
    END;

    -- Insert into crm_leads
    INSERT INTO public.crm_leads (
        name,
        phone,
        whatsapp_number,
        source,
        status,
        pipeline_stage,
        notes,
        estimated_value_monthly,
        priority,
        appointment_datetime
    ) VALUES (
        NEW.full_name,
        NEW.phone,
        NEW.phone,
        'Website Booking',
        'New',
        'New Lead',
        appointment_notes,
        0,
        'hot',
        parsed_appointment_datetime
    )
    RETURNING id INTO new_lead_id;

    -- Log activity so it triggers the Needs Attention dashboard notification
    INSERT INTO public.crm_lead_activity (
        lead_id,
        event_type,
        description,
        metadata
    ) VALUES (
        new_lead_id,
        'form_filled',
        'Website appointment booked for ' || service_label,
        jsonb_build_object(
            'lead_name', NEW.full_name,
            'source', 'Website Booking',
            'service', service_label
        )
    );

    -- Link the appointment back to the created lead
    UPDATE public.appointments
    SET crm_lead_id = new_lead_id
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;
