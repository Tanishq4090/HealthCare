-- Remove client master rows whose lead was permanently deleted (ghost records like "Mark")
DELETE FROM public.clients c
WHERE NOT EXISTS (
    SELECT 1 FROM public.crm_leads l WHERE l.id = c.id
);
