-- 002_idempotency_and_transitions.sql
-- 1. Function to insert messages with idempotency (dedup on MessageSid)
-- 2. Trigger to enforce status transitions on leads table

CREATE OR REPLACE FUNCTION insert_message_idempotent(
    p_lead_id UUID,
    p_direction TEXT,
    p_body TEXT,
    p_sid TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO public.communications (lead_id, direction, message_body, message_sid)
    VALUES (p_lead_id, p_direction, p_body, p_sid)
    ON CONFLICT (message_sid) DO NOTHING;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger for valid transitions
CREATE OR REPLACE FUNCTION enforce_lead_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions JSONB := '{
        "new": ["inquiry", "closed"],
        "inquiry": ["quote_sent", "closed"],
        "quote_sent": ["form_submitted", "closed"],
        "form_submitted": ["staff_searching", "closed"],
        "staff_searching": ["staff_confirmed", "closed"],
        "staff_confirmed": ["deposit_pending", "closed"],
        "deposit_pending": ["deposit_received", "closed"],
        "deposit_received": ["active", "closed"],
        "active": ["monthly_billing", "closed"],
        "monthly_billing": ["active", "closed"]
    }';
BEGIN
    IF NEW.status_override = true THEN
        -- Allow override but reset flag
        NEW.status_override := false;
        RETURN NEW;
    END IF;

    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Validate transition
    IF NOT (valid_transitions -> OLD.status::text) ? NEW.status::text THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_lead_status
    BEFORE UPDATE OF status ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION enforce_lead_status_transition();
