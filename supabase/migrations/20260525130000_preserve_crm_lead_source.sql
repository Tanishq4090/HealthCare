-- Preserve original lead source on updates (AI Phone Call, WhatsApp Chat, Manual Add, etc.)
CREATE OR REPLACE FUNCTION public.preserve_crm_lead_source()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.source IS NOT NULL
       AND BTRIM(OLD.source) <> ''
       AND NEW.source IS DISTINCT FROM OLD.source
    THEN
        NEW.source := OLD.source;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_preserve_crm_lead_source ON public.crm_leads;
CREATE TRIGGER trg_preserve_crm_lead_source
    BEFORE UPDATE ON public.crm_leads
    FOR EACH ROW
    EXECUTE FUNCTION public.preserve_crm_lead_source();
