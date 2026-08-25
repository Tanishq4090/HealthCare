import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('worker_assignments')
        .select('id')
        .eq('client_id', 'a78fee96-053a-4b9a-864e-093466451957')
        .eq('assignment_status', 'active')
        .maybeSingle();
        
    console.log('Data:', data);
    console.log('Error:', error);
}
check();
