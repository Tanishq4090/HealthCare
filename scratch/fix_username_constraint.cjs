#!/usr/bin/env node
// Fix: employees.username unique constraint → partial index (NULL allowed)
// Uses Supabase Management API to run DDL directly

const https = require('https');

// These come from the Supabase project ref in the URL
const PROJECT_REF = 'sgyladamwnanudnropwl';

// SQL to fix the constraint
const SQL = `
-- Drop the full unique constraint (allows multiple NULLs in PG but let's be explicit)
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_username_key;

-- Drop any old partial index
DROP INDEX IF EXISTS idx_employees_username_unique;

-- Create partial unique index: only enforce uniqueness when username IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_username_unique
    ON public.employees (username)
    WHERE username IS NOT NULL;

SELECT 'OK - partial unique index created on employees.username' AS result;
`.trim();

console.log('SQL to run:\n', SQL);
console.log('\n--- To apply this fix manually ---');
console.log('Go to: https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new');
console.log('And paste the following SQL:\n');
console.log(SQL);
