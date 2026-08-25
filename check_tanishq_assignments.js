import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: rows } = await supabase
        .from('service_worker_assignments')
        .select(`
            id, service_id, employee_id, start_date, end_date, created_at,
            employees(full_name)
        `)
        .eq('service_id', '7cb2f2c3-7935-47ef-816f-0d6c37201736');

    console.log('Worker assignments for Tanishq service:');
    console.log(rows);
}
check();
