-- ============================================================
-- Migration: Create appointments table + auto CRM lead trigger
-- Purpose: Allow public website appointment bookings to save
--          to Supabase, then auto-create a lead in crm_leads
--          so it appears in the CRM pipeline immediately.
-- Date: 2026-04-27
-- ============================================================

-- 1. Create the appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    service TEXT NOT NULL,
    preferred_date DATE NOT NULL,
    preferred_time TEXT NOT NULL,
    location TEXT NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    crm_lead_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 3. Public (anon) can INSERT only — this is how the booking form works
DROP POLICY IF EXISTS "Anyone can book an appointment" ON public.appointments;
CREATE POLICY "Anyone can book an appointment"
    ON public.appointments
    FOR INSERT
    WITH CHECK (true);

-- 4. Only authenticated staff can view/manage appointments
DROP POLICY IF EXISTS "Authenticated users can view appointments" ON public.appointments;
CREATE POLICY "Authenticated users can view appointments"
    ON public.appointments
    FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.appointments;
CREATE POLICY "Authenticated users can update appointments"
    ON public.appointments
    FOR UPDATE
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON public.appointments;
CREATE POLICY "Authenticated users can delete appointments"
    ON public.appointments
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- 5. Trigger function: auto-create a CRM lead when appointment is booked
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
    -- Human-readable service label for CRM display
    service_label := initcap(replace(NEW.service, '-', ' '));

    -- Build notes field
    appointment_notes := 'Service: ' || service_label
        || E'\nDate: ' || to_char(NEW.preferred_date, 'DD Mon YYYY') || ' at ' || NEW.preferred_time
        || E'\nLocation: ' || NEW.location
        || CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> '' THEN E'\nPatient Notes: ' || NEW.notes ELSE '' END
        || CASE WHEN NEW.email IS NOT NULL AND NEW.email <> '' THEN E'\nEmail: ' || NEW.email ELSE '' END;

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
        priority
    ) VALUES (
        NEW.full_name,
        NEW.phone,
        NEW.phone,
        'Website Booking',
        'New',
        'New Lead',
        appointment_notes,
        0,
        'hot'
    )
    RETURNING id INTO new_lead_id;

    -- Link the appointment back to the created lead
    UPDATE public.appointments
    SET crm_lead_id = new_lead_id
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$;

-- 6. Attach trigger to appointments table
DROP TRIGGER IF EXISTS on_appointment_created ON public.appointments;
CREATE TRIGGER on_appointment_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.appointment_to_crm_lead();

-- 7. Grant usage on the trigger function
GRANT EXECUTE ON FUNCTION public.appointment_to_crm_lead() TO service_role, anon, authenticated;
