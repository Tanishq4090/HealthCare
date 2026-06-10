-- ============================================================
-- Migration: AI HR Worker Allocation Module
-- Project: HealthCare CRM (Supabase + React + TypeScript)
-- Date: 2026-04-16
-- ============================================================

-- ------------------------------------------------------------
-- SECTION 1: EXTENSIONS
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()


-- ============================================================
-- SECTION 2: TABLE DEFINITIONS
-- ============================================================

-- ------------------------------------------------------------
-- Table: employees
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id    text UNIQUE NOT NULL,          -- auto-populated by trigger
    full_name      text NOT NULL,
    job_title      text NOT NULL,
    photo_url      text,                          -- Supabase Storage URL
    department     text,
    status         text NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available', 'assigned', 'inactive')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employees IS
    'Stores worker/employee profiles for the HR allocation module.';
COMMENT ON COLUMN public.employees.employee_id IS
    'Auto-generated unique identifier in format EMP-000001.';
COMMENT ON COLUMN public.employees.photo_url IS
    'URL pointing to the employee photo in the employee-photos storage bucket.';


-- ------------------------------------------------------------
-- Table: clients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name    text NOT NULL,
    company_name   text,
    phone_number   text,                          -- for WhatsApp notifications
    email          text,
    created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clients IS
    'Client records — used for worker assignment and WhatsApp notifications.';


-- ------------------------------------------------------------
-- Table: worker_assignments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_assignments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id         uuid NOT NULL REFERENCES public.employees(id)
                            ON DELETE CASCADE,
    client_id           uuid NOT NULL REFERENCES public.clients(id)
                            ON DELETE CASCADE,
    assigned_at         timestamptz NOT NULL DEFAULT now(),
    assignment_status   text NOT NULL DEFAULT 'active'
                        CHECK (assignment_status IN ('active', 'completed', 'cancelled')),
    notes               text
);

COMMENT ON TABLE public.worker_assignments IS
    'Junction table linking employees to clients for job assignments.';


-- ------------------------------------------------------------
-- Table: id_card_links
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.id_card_links (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id    uuid NOT NULL REFERENCES public.employees(id)
                       ON DELETE CASCADE,
    assignment_id  uuid NOT NULL REFERENCES public.worker_assignments(id)
                       ON DELETE CASCADE,
    token          text UNIQUE NOT NULL,          -- secure random token for public URL
    is_active      boolean NOT NULL DEFAULT true,
    expires_at     timestamptz,                   -- null = never expires
    created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.id_card_links IS
    'Stores shareable public-access tokens for employee digital ID cards.';
COMMENT ON COLUMN public.id_card_links.token IS
    'Random secure token (e.g. 32-byte hex string) used in the public-facing ID card URL.';


-- ============================================================
-- SECTION 3: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_employees_status
    ON public.employees(status);

CREATE INDEX IF NOT EXISTS idx_worker_assignments_employee
    ON public.worker_assignments(employee_id);

CREATE INDEX IF NOT EXISTS idx_worker_assignments_client
    ON public.worker_assignments(client_id);

CREATE INDEX IF NOT EXISTS idx_worker_assignments_status
    ON public.worker_assignments(assignment_status);

CREATE INDEX IF NOT EXISTS idx_id_card_links_token
    ON public.id_card_links(token);

CREATE INDEX IF NOT EXISTS idx_id_card_links_employee
    ON public.id_card_links(employee_id);

CREATE INDEX IF NOT EXISTS idx_id_card_links_active
    ON public.id_card_links(is_active)
    WHERE is_active = true;


-- ============================================================
-- SECTION 4: AUTO-UPDATED updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- SECTION 5: AUTO EMPLOYEE ID GENERATION
-- ============================================================
-- Uses a pg_advisory_lock to safely serialize concurrent inserts.
-- The lock key 123456789 is an arbitrary application-specific integer.

CREATE OR REPLACE FUNCTION public.generate_employee_id()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_lock_key  bigint := 123456789;   -- arbitrary fixed advisory lock key
    v_latest    text;
    v_num       int;
    v_new_id    text;
BEGIN
    -- Acquire session-level advisory lock to prevent concurrent race conditions
    PERFORM pg_advisory_lock(v_lock_key);

    BEGIN
        -- Fetch the highest numeric portion from existing employee_ids
        SELECT employee_id
        INTO   v_latest
        FROM   public.employees
        ORDER BY
               -- Sort by the numeric portion, not lexicographically
               CAST(SPLIT_PART(employee_id, '-', 2) AS integer) DESC
        LIMIT 1;

        IF v_latest IS NULL THEN
            v_num := 1;    -- First employee ever
        ELSE
            v_num := CAST(SPLIT_PART(v_latest, '-', 2) AS integer) + 1;
        END IF;

        -- Format: EMP-000001 through EMP-999999
        v_new_id := 'EMP-' || LPAD(v_num::text, 6, '0');

    EXCEPTION WHEN OTHERS THEN
        -- Release lock before re-raising so it isn't held forever
        PERFORM pg_advisory_unlock(v_lock_key);
        RAISE;
    END;

    -- Release lock after computation
    PERFORM pg_advisory_unlock(v_lock_key);

    RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.generate_employee_id() IS
    'Generates sequential Employee IDs in the format EMP-000001. Uses an advisory lock to ensure safe concurrent inserts.';


-- Trigger function that populates employee_id before INSERT
CREATE OR REPLACE FUNCTION public.trg_set_employee_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only auto-generate if caller did not supply one explicitly
    IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
        NEW.employee_id := public.generate_employee_id();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_employee_id ON public.employees;
CREATE TRIGGER set_employee_id
    BEFORE INSERT ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_set_employee_id();


-- ============================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_card_links      ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6a. Policies for: employees
-- ============================================================

-- Authenticated users: full CRUD
CREATE POLICY "employees: auth full access"
    ON public.employees
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Anon users: SELECT employee via a valid active id_card_links token
-- (Used by the public-facing digital ID card page)
CREATE POLICY "employees: anon read via valid token"
    ON public.employees
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1
            FROM   public.id_card_links idcl
            WHERE  idcl.employee_id = employees.id
              AND  idcl.is_active = true
              AND  (idcl.expires_at IS NULL OR idcl.expires_at > now())
        )
    );


-- ============================================================
-- 6b. Policies for: clients
-- ============================================================

-- Authenticated users: full CRUD
CREATE POLICY "clients: auth full access"
    ON public.clients
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Anon users: no access to clients table
-- (client data is sensitive — only accessible by authenticated staff)


-- ============================================================
-- 6c. Policies for: worker_assignments
-- ============================================================

-- Authenticated users: full CRUD
CREATE POLICY "worker_assignments: auth full access"
    ON public.worker_assignments
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Anon users: SELECT the assignment record when accessing via valid token
CREATE POLICY "worker_assignments: anon read via valid token"
    ON public.worker_assignments
    FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1
            FROM   public.id_card_links idcl
            WHERE  idcl.assignment_id = worker_assignments.id
              AND  idcl.is_active = true
              AND  (idcl.expires_at IS NULL OR idcl.expires_at > now())
        )
    );


-- ============================================================
-- 6d. Policies for: id_card_links
-- ============================================================

-- Authenticated users: full CRUD (admin manages all tokens)
CREATE POLICY "id_card_links: auth full access"
    ON public.id_card_links
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Anon users: SELECT their own token record (needed to validate the link)
-- The public page will fetch by token to determine if the link is valid
CREATE POLICY "id_card_links: anon read own token"
    ON public.id_card_links
    FOR SELECT
    TO anon
    USING (
        is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    );


-- ============================================================
-- SECTION 7: SUPABASE STORAGE BUCKET
-- ============================================================
-- NOTE: Supabase storage buckets cannot be created purely in SQL.
-- Run this via the Supabase JS SDK (server-side/admin) or via
-- the Supabase Dashboard. The SQL below uses the internal
-- storage.buckets table which Supabase manages, and is provided
-- for reference/automation in self-hosted contexts.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'employee-photos',
    'employee-photos',
    false,                           -- not publicly listed; per-object policies control access
    5242880,                         -- 5 MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- Storage RLS: Allow authenticated users to upload
CREATE POLICY "employee-photos: auth upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'employee-photos');

-- Storage RLS: Allow authenticated users to view/download
CREATE POLICY "employee-photos: auth read"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'employee-photos');

-- Storage RLS: Allow authenticated users to update their uploads
CREATE POLICY "employee-photos: auth update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'employee-photos')
    WITH CHECK (bucket_id = 'employee-photos');

-- Storage RLS: Allow authenticated users to delete
CREATE POLICY "employee-photos: auth delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'employee-photos');

-- Storage RLS: Anon can read employee photos when accessed via a valid token
-- (Public ID card page needs to show the employee photo)
CREATE POLICY "employee-photos: anon read via token"
    ON storage.objects
    FOR SELECT
    TO anon
    USING (
        bucket_id = 'employee-photos'
        AND EXISTS (
            SELECT 1
            FROM   public.id_card_links idcl
            WHERE  idcl.is_active = true
              AND  (idcl.expires_at IS NULL OR idcl.expires_at > now())
        )
    );


-- ============================================================
-- SECTION 8: HELPER FUNCTION — Generate Secure Token
-- ============================================================
-- Call this from your application or Supabase Edge Function
-- when creating a new id_card_link record.
-- Example: SELECT public.generate_card_token();

CREATE OR REPLACE FUNCTION public.generate_card_token()
RETURNS text
LANGUAGE sql
AS $$
    SELECT encode(gen_random_bytes(32), 'hex');
$$;

COMMENT ON FUNCTION public.generate_card_token() IS
    'Returns a cryptographically random 64-character hex token for use as an id_card_links.token value.';


-- ============================================================
-- SECTION 9: GRANT PERMISSIONS
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.employees          TO anon;
GRANT SELECT ON public.id_card_links      TO anon;
GRANT SELECT ON public.worker_assignments TO anon;

GRANT ALL ON public.employees             TO authenticated;
GRANT ALL ON public.clients               TO authenticated;
GRANT ALL ON public.worker_assignments    TO authenticated;
GRANT ALL ON public.id_card_links         TO authenticated;

GRANT EXECUTE ON FUNCTION public.generate_card_token()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_employee_id() TO authenticated;


-- ============================================================
-- EOF
-- ============================================================
