-- ============================================================
-- Migration: Fix employees username unique constraint
-- Purpose: Allow multiple NULL usernames (only enforce uniqueness
--          when a username is actually set).
-- ============================================================

-- 1. Drop the existing UNIQUE constraint on username
--    (constraint name is typically "employees_username_key")
DO $$ BEGIN
    ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_username_key;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Drop any existing partial index on username (if one exists)
DROP INDEX IF EXISTS idx_employees_username_unique;

-- 3. Create a PARTIAL unique index that only enforces uniqueness
--    when username is NOT NULL. Multiple NULLs are freely allowed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_username_unique
    ON public.employees (username)
    WHERE username IS NOT NULL;
