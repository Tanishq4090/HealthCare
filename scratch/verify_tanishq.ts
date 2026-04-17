import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    const { data: leads } = await supabase.from('crm_leads').select('*').ilike('name', '%Tanishq%');
    console.log('CRM LEADS:', leads);
    
    if (leads && leads.length > 0) {
        const { data: assignments } = await supabase.from('worker_assignments').select('*').eq('client_id', leads[0].id);
        console.log('ASSIGNMENTS FOR LEAD ID:', assignments);
    }
    
    const { data: clients } = await supabase.from('clients').select('*').ilike('client_name', '%Tanishq%');
    console.log('CLIENTS:', clients);
    
    if (clients && clients.length > 0) {
        const { data: clientAssignments } = await supabase.from('worker_assignments').select('*').eq('client_id', clients[0].id);
        console.log('ASSIGNMENTS FOR CLIENT ID:', clientAssignments);
    }
}
run();
