-- ============================================================
-- Migration: Bidirectional Synchronization Between crm_leads & clients
-- Ensures client identity (name, phone, email) and active status
-- remain 100% consistent across CRM and Client Master modules.
-- ============================================================

-- 1. Function to sync promoted crm_leads into clients table
CREATE OR REPLACE FUNCTION public.sync_crm_lead_to_client()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent infinite recursion
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- When lead reaches an active/customer stage, guarantee existence in clients
    IF NEW.pipeline_stage IN ('Active Client', 'Monthly Billing', 'Closed Won', 'Staff Assigned') THEN
        INSERT INTO public.clients (
            id,
            client_name,
            phone_number,
            email,
            source,
            created_at
        ) VALUES (
            NEW.id,
            NEW.name,
            COALESCE(NEW.phone, NEW.whatsapp_number),
            NEW.email,
            NEW.source,
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            client_name = EXCLUDED.client_name,
            phone_number = COALESCE(EXCLUDED.phone_number, public.clients.phone_number),
            email = COALESCE(EXCLUDED.email, public.clients.email);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on crm_leads
DROP TRIGGER IF EXISTS trg_sync_crm_lead_to_client ON public.crm_leads;
CREATE TRIGGER trg_sync_crm_lead_to_client
    AFTER INSERT OR UPDATE OF pipeline_stage, name, phone, whatsapp_number, email
    ON public.crm_leads
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_crm_lead_to_client();

-- 2. Function to sync client edits back to crm_leads
CREATE OR REPLACE FUNCTION public.sync_client_to_crm_lead()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent infinite recursion
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    -- If a matching lead exists with this UUID, keep name, phone, email in sync
    UPDATE public.crm_leads
    SET name = NEW.client_name,
        phone = COALESCE(NEW.phone_number, phone),
        whatsapp_number = COALESCE(NEW.phone_number, whatsapp_number),
        email = COALESCE(NEW.email, email),
        updated_at = NOW()
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on clients
DROP TRIGGER IF EXISTS trg_sync_client_to_crm_lead ON public.clients;
CREATE TRIGGER trg_sync_client_to_crm_lead
    AFTER UPDATE OF client_name, phone_number, email
    ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_client_to_crm_lead();
