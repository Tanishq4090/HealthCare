-- Ensure all leads use visible "New Inquiry" stage (not hidden legacy stages)
UPDATE public.crm_leads
SET pipeline_stage = 'New Inquiry'
WHERE pipeline_stage IS NULL
   OR pipeline_stage IN ('New Lead', 'New');

-- Remove legacy stages from global pipeline configuration
DO $$
DECLARE
  stages jsonb;
  cleaned text[] := ARRAY['New Inquiry'];
  elem text;
BEGIN
  SELECT COALESCE(pipeline_stages, '[]'::jsonb)
  INTO stages
  FROM public.automation_settings
  WHERE id = 'global';

  IF stages IS NULL THEN
    stages := '[]'::jsonb;
  END IF;

  FOR elem IN SELECT jsonb_array_elements_text(stages)
  LOOP
    IF elem NOT IN ('New Lead', 'New', 'New Inquiry')
       AND NOT elem = ANY(cleaned) THEN
      cleaned := array_append(cleaned, elem);
    END IF;
  END LOOP;

  UPDATE public.automation_settings
  SET pipeline_stages = to_jsonb(cleaned)
  WHERE id = 'global';
END $$;

-- Website bookings should create leads in New Inquiry
CREATE OR REPLACE FUNCTION public.appointment_to_crm_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_lead_id UUID;
    service_label TEXT;
    appointment_notes TEXT;
BEGIN
    service_label := initcap(replace(NEW.service, '-', ' '));

    appointment_notes := 'Service: ' || service_label
        || E'\nDate: ' || to_char(NEW.preferred_date, 'DD Mon YYYY') || ' at ' || NEW.preferred_time
        || E'\nLocation: ' || NEW.location
        || CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> '' THEN E'\nPatient Notes: ' || NEW.notes ELSE '' END
        || CASE WHEN NEW.email IS NOT NULL AND NEW.email <> '' THEN E'\nEmail: ' || NEW.email ELSE '' END;

    INSERT INTO public.crm_leads (
        name,
        phone,
        whatsapp_number,
        source,
        status,
        pipeline_stage,
        notes,
        estimated_value_monthly,
        priority
    ) VALUES (
        NEW.full_name,
        NEW.phone,
        NEW.phone,
        'Website Booking',
        'New',
        'New Inquiry',
        appointment_notes,
        0,
        'hot'
    )
    RETURNING id INTO new_lead_id;

    UPDATE public.appointments
    SET crm_lead_id = new_lead_id
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;
