import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
    console.log('Testing queries...');
    const q1 = await supabase.from('crm_leads').select('id, name').limit(1);
    console.log('crm_leads:', q1.error || 'Success');

    const q2 = await supabase.from('employees').select('id, full_name, contact_number, job_title').limit(1);
    console.log('employees:', q2.error || 'Success');

    const q3 = await supabase.from('worker_assignments').select('id, final_invoice_number, clients(client_name)').limit(1);
    console.log('worker_assignments:', q3.error || 'Success');
}
test();
